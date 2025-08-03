const axios = require('axios');
const { AI_AGENT_CONFIG, PROMPT_TEMPLATES, DATA_FORMATTERS } = require('../config/aiPrompts');

class OllamaService {
  constructor(pool = null) {
    this.baseURL = process.env.OLLAMA_HOST || 'http://ollama:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || AI_AGENT_CONFIG.models.default;
    this.pool = pool;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 minute timeout for AI responses
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.cachedSettings = null;
    this.settingsLastLoaded = 0;
  }

  async loadSettings() {
    // Cache settings for 5 minutes
    const now = Date.now();
    if (this.cachedSettings && (now - this.settingsLastLoaded) < 300000) {
      return this.cachedSettings;
    }

    if (!this.pool) {
      return {
        agent_config: AI_AGENT_CONFIG,
        system_prompts: null,
        coaching_tips: []
      };
    }

    try {
      // Load settings from database
      const settingsResult = await this.pool.query(`
        SELECT setting_key, setting_value
        FROM ai_settings
        WHERE setting_key IN ('agent_config', 'system_prompts')
      `);

      // Load coaching tips
      const tipsResult = await this.pool.query(`
        SELECT category, title, content, trigger_conditions
        FROM ai_coaching_tips
        WHERE is_active = true
        ORDER BY category, title
      `);

      const settings = {
        agent_config: AI_AGENT_CONFIG,
        system_prompts: null,
        coaching_tips: tipsResult.rows || []
      };

      settingsResult.rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });

      this.cachedSettings = settings;
      this.settingsLastLoaded = now;
      
      return settings;
    } catch (error) {
      console.error('⚠️ Could not load AI settings from database, using defaults:', error.message);
      return {
        agent_config: AI_AGENT_CONFIG,
        system_prompts: null,
        coaching_tips: []
      };
    }
  }

  async isAvailable() {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      console.error('❌ Ollama not available:', error.message);
      return false;
    }
  }

  async getAvailableModels() {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      console.error('❌ Error fetching models:', error.message);
      return [];
    }
  }

  async generateResponse(prompt, model = null, context = null) {
    try {
      const requestModel = model || this.defaultModel;
      
      console.log(`🤖 Generating response with ${requestModel}...`);
      
      const payload = {
        model: requestModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: AI_AGENT_CONFIG.generation.temperature,
          top_k: AI_AGENT_CONFIG.generation.top_k,
          top_p: AI_AGENT_CONFIG.generation.top_p,
          num_predict: AI_AGENT_CONFIG.generation.num_predict
        }
      };

      if (context) {
        payload.context = context;
      }

      const response = await this.client.post('/api/generate', payload);
      
      if (response.data && response.data.response) {
        console.log(`✅ AI response generated (${response.data.response.length} chars)`);
        return {
          success: true,
          response: response.data.response,
          context: response.data.context,
          model: requestModel,
          done: response.data.done
        };
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      console.error('❌ Ollama generation error:', error.message);
      return {
        success: false,
        error: error.message,
        response: 'Sorry, I encountered an error processing your request. Please try again.'
      };
    }
  }

  async chatCompletion(messages, model = null) {
    try {
      const requestModel = model || this.defaultModel;
      
      console.log(`💬 Chat completion with ${requestModel}...`);
      
      const payload = {
        model: requestModel,
        messages: messages,
        stream: false,
        options: {
          temperature: AI_AGENT_CONFIG.generation.temperature,
          top_k: AI_AGENT_CONFIG.generation.top_k,
          top_p: AI_AGENT_CONFIG.generation.top_p
        }
      };

      const response = await this.client.post('/api/chat', payload);
      
      if (response.data && response.data.message) {
        console.log(`✅ Chat response generated`);
        return {
          success: true,
          message: response.data.message,
          model: requestModel,
          done: response.data.done
        };
      } else {
        throw new Error('Invalid chat response format from Ollama');
      }
    } catch (error) {
      console.error('❌ Ollama chat error:', error.message);
      return {
        success: false,
        error: error.message,
        message: { content: 'Sorry, I encountered an error processing your request. Please try again.' }
      };
    }
  }

  buildPerformanceContext(userData, performanceData, goals = null) {
    const context = {
      user: {
        id: userData.id,
        name: userData.name,
        role: userData.role,
        market: userData.market_name,
        store: userData.store_name
      },
      performance: {},
      timeframe: null
    };

    if (performanceData && performanceData.length > 0) {
      const latest = performanceData[0];
      context.timeframe = latest.upload_date;
      context.performance = latest.data || {};
    }

    if (goals) {
      context.goals = goals;
    }

    return context;
  }

  generatePerformancePrompt(query, context) {
    const template = PROMPT_TEMPLATES.chat.template;
    const rolePrompt = DATA_FORMATTERS.getRolePrompt(context.user.role);
    const performanceData = DATA_FORMATTERS.formatPerformanceData(context.performance);
    const goalsSection = DATA_FORMATTERS.formatGoals(context.goals);

    return template
      .replace('{rolePrompt}', rolePrompt)
      .replace('{userName}', context.user.name || 'Unknown')
      .replace('{userRole}', context.user.role || 'advisor')
      .replace('{userMarket}', context.user.market || 'Unknown Market')
      .replace('{userStore}', context.user.store || 'Unknown Store')
      .replace('{timeframe}', context.timeframe || 'No data period specified')
      .replace('{performanceData}', performanceData)
      .replace('{goalsSection}', goalsSection)
      .replace('{userQuery}', query);
  }

  generateInsightPrompt(context, type = 'general') {
    const template = PROMPT_TEMPLATES.insights[type] || PROMPT_TEMPLATES.insights.general;
    const rolePrompt = DATA_FORMATTERS.getRolePrompt(context.user.role);
    const performanceData = DATA_FORMATTERS.formatPerformanceData(context.performance);
    const goalsSection = DATA_FORMATTERS.formatGoals(context.goals);

    return template
      .replace('{rolePrompt}', rolePrompt)
      .replace('{userName}', context.user.name || 'Unknown')
      .replace('{userRole}', context.user.role || 'advisor')
      .replace('{userMarket}', context.user.market || 'Unknown Market')
      .replace('{userStore}', context.user.store || 'Unknown Store')
      .replace('{timeframe}', context.timeframe || 'No data period specified')
      .replace('{performanceData}', performanceData)
      .replace('{goalsSection}', goalsSection);
  }
}

module.exports = OllamaService;