const axios = require('axios');
const { AI_AGENT_CONFIG, PROMPT_TEMPLATES, DATA_FORMATTERS } = require('../config/aiPrompts');
const AIDataService = require('./aiDataService');

class OllamaService {
  constructor(pool = null) {
    this.baseURL = process.env.OLLAMA_HOST || 'http://ollama:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || AI_AGENT_CONFIG.models.default;
    this.pool = pool;
    this.aiDataService = pool ? new AIDataService(pool) : null;
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

  async buildEnhancedContext(userId, query = null) {
    if (!this.aiDataService) {
      console.warn('⚠️ AI Data Service not available, falling back to basic context');
      return this.buildBasicContext(userId);
    }

    try {
      console.log('🔄 Building enhanced AI context with full business intelligence...');
      const context = await this.aiDataService.buildComprehensiveContext(userId, query);
      console.log('✅ Enhanced context built successfully');
      return context;
    } catch (error) {
      console.error('❌ Error building enhanced context, falling back to basic:', error.message);
      return this.buildBasicContext(userId);
    }
  }

  async buildBasicContext(userId) {
    // Fallback method for basic context when AI Data Service is not available
    if (!this.pool) {
      return {
        user: { id: userId, name: 'Unknown User', role: 'advisor' },
        performance: {},
        timeframe: null,
        error: 'No database connection available'
      };
    }

    try {
      // Get basic user and performance data
      const userResult = await this.pool.query(`
        SELECT DISTINCT
          u.id, u.first_name as "firstName", u.last_name as "lastName",
          u.email, u.role, u.status,
          s.name as store_name, s.id as store_id,
          m.name as market_name, m.id as market_id
        FROM users u
        LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
        LEFT JOIN stores s ON usa.store_id::integer = s.id
        LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
        LEFT JOIN markets m ON uma.market_id::integer = m.id
        WHERE u.id = $1
      `, [userId]);

      const userData = userResult.rows[0] || {};
      userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User';

      // Get latest MTD data per month
      const performanceResult = await this.pool.query(`
        WITH latest_per_month AS (
          SELECT 
            EXTRACT(YEAR FROM upload_date) as year,
            EXTRACT(MONTH FROM upload_date) as month,
            MAX(upload_date) as latest_date
          FROM performance_data
          WHERE advisor_user_id = $1 AND data_type = 'services'
          GROUP BY EXTRACT(YEAR FROM upload_date), EXTRACT(MONTH FROM upload_date)
          ORDER BY year DESC, month DESC
          LIMIT 3
        )
        SELECT 
          pd.upload_date, 
          pd.data, 
          pd.store_id,
          s.name as store_name,
          m.name as market_name
        FROM performance_data pd
        LEFT JOIN stores s ON pd.store_id = s.id
        LEFT JOIN markets m ON s.market_id = m.id
        JOIN latest_per_month lpm ON pd.upload_date = lpm.latest_date
        WHERE pd.advisor_user_id = $1 AND pd.data_type = 'services'
        ORDER BY pd.upload_date DESC
      `, [userId]);

      const goalsResult = await this.pool.query(`
        SELECT metric_name, target_value, period_type, goal_type
        FROM goals
        WHERE goal_type = 'advisor' AND advisor_user_id = $1
        ORDER BY effective_date DESC
      `, [userId]);

      return {
        user: {
          id: userData.id,
          name: userData.name,
          role: userData.role,
          market: userData.market_name,
          store: userData.store_name
        },
        performance: {
          latest: performanceResult.rows[0]?.data || {},
          recent_data: performanceResult.rows,
          timeframe: performanceResult.rows[0]?.upload_date || null
        },
        goals: goalsResult.rows,
        context_type: 'basic'
      };
    } catch (error) {
      console.error('❌ Error building basic context:', error);
      return {
        user: { id: userId, name: 'Unknown User', role: 'advisor' },
        performance: {},
        timeframe: null,
        error: error.message
      };
    }
  }

  buildPerformanceContext(userData, performanceData, goals = null) {
    // Legacy method for backward compatibility
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

  generateEnhancedPrompt(query, context) {
    try {
      const rolePrompt = DATA_FORMATTERS.getRolePrompt(context.user.role);
      
      // Build comprehensive context information
      let contextInfo = `
**USER PROFILE:**
- Name: ${context.user.name || 'Unknown'}
- Role: ${context.user.role || 'advisor'}
- Market: ${context.user.market || 'Unknown Market'}
- Store: ${context.user.store || 'Unknown Store'}

**PERFORMANCE DATA:**`;

      if (context.performance?.latest && Object.keys(context.performance.latest).length > 0) {
        const perfData = DATA_FORMATTERS.formatPerformanceData(context.performance.latest);
        contextInfo += `
${perfData}
- Data Period: ${context.performance.timeframe || 'Unknown'}`;
      } else {
        contextInfo += `
- No recent performance data available`;
      }

      // Add goals information
      if (context.goals && context.goals.length > 0) {
        const goalsSection = DATA_FORMATTERS.formatGoals(context.goals);
        contextInfo += `

**GOALS & TARGETS:**
${goalsSection}`;
      }

      // Add business intelligence context
      if (context.business_intelligence) {
        const bi = context.business_intelligence;
        
        if (bi.markets && bi.markets.length > 0) {
          contextInfo += `

**MARKET INFORMATION:**`;
          bi.markets.forEach(market => {
            contextInfo += `
- ${market.name}: ${market.store_count} stores`;
            if (market.vendor_tag_details && market.vendor_tag_details.length > 0) {
              const vendors = market.vendor_tag_details.map(v => v.name).join(', ');
              contextInfo += ` (Vendors: ${vendors})`;
            }
          });
        }

        if (bi.market_performance && bi.market_performance.length > 0) {
          contextInfo += `

**MARKET PERFORMANCE DATA (Latest MTD Spreadsheet):**`;
          bi.market_performance.slice(0, 3).forEach(perf => {
            const uploadMonth = new Date(perf.upload_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            contextInfo += `
- ${perf.market_name} - ${uploadMonth} MTD: $${perf.total_sales?.toLocaleString() || 'N/A'} total sales, ${perf.advisor_count} advisors, ${perf.avg_gp_percent?.toFixed(1) || 'N/A'}% avg GP`;
          });
        }

        if (bi.stores && bi.stores.length > 0) {
          contextInfo += `

**STORE INFORMATION:**`;
          bi.stores.slice(0, 3).forEach(store => {
            contextInfo += `
- ${store.name} (${store.city}, ${store.state}): ${store.advisor_count} advisors, Manager: ${store.manager_name}`;
          });
        }

        if (bi.vendors && bi.vendors.length > 0) {
          contextInfo += `

**VENDOR PRODUCT MAPPINGS:**`;
          const vendorGroups = {};
          bi.vendors.forEach(vendor => {
            if (!vendorGroups[vendor.vendorName]) {
              vendorGroups[vendor.vendorName] = [];
            }
            vendorGroups[vendor.vendorName].push(vendor.serviceField);
          });
          
          Object.entries(vendorGroups).slice(0, 3).forEach(([vendorName, services]) => {
            contextInfo += `
- ${vendorName}: ${services.slice(0, 5).join(', ')}${services.length > 5 ? '...' : ''}`;
          });
        }

        if (bi.services && bi.services.length > 0) {
          const categories = {};
          bi.services.forEach(service => {
            if (!categories[service.category_name]) {
              categories[service.category_name] = 0;
            }
            categories[service.category_name]++;
          });
          
          contextInfo += `

**SERVICE CATALOG:**`;
          Object.entries(categories).slice(0, 5).forEach(([category, count]) => {
            contextInfo += `
- ${category}: ${count} services`;
          });
        }
      }

      // Add peer comparison data
      if (context.benchmarking?.peers && context.benchmarking.peers.length > 0) {
        contextInfo += `

**PEER COMPARISON AVAILABLE:**
- ${context.benchmarking.peers.length} peer advisors for benchmarking`;
      }

      // Add top performers if available
      if (context.benchmarking?.top_performers && context.benchmarking.top_performers.length > 0) {
        contextInfo += `

**TOP PERFORMERS (Latest MTD):**`;
        context.benchmarking.top_performers.forEach((performer, index) => {
          contextInfo += `
${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value} units - $${performer.total_sales?.toLocaleString() || 'N/A'} total sales`;
        });
      }

      // Add coaching context
      if (context.coaching?.recent_threads && context.coaching.recent_threads.length > 0) {
        contextInfo += `

**RECENT COACHING:**
- ${context.coaching.recent_threads.length} recent coaching conversations available`;
      }

      const enhancedTemplate = `${rolePrompt}

You have access to comprehensive business intelligence data for ${context.user.name}.

${contextInfo}

**USER QUERY:** ${query}

IMPORTANT: All performance data comes from the latest MTD (month-to-date) spreadsheet for each time period. When asked about monthly sales/performance, use the final MTD totals from the last upload of that month. For example:
- "July 2025 sales" = final MTD totals from last July upload  
- "August 2025 sales" = current MTD totals from last August upload

Provide detailed, data-driven insights based on all available information. Reference specific metrics, compare to goals, and provide actionable recommendations.`;

      return enhancedTemplate;

    } catch (error) {
      console.error('❌ Error generating enhanced prompt:', error);
      // Fall back to basic prompt
      return this.generatePerformancePrompt(query, context);
    }
  }

  generatePerformancePrompt(query, context) {
    const template = PROMPT_TEMPLATES.chat.template;
    const rolePrompt = DATA_FORMATTERS.getRolePrompt(context.user.role);
    const performanceData = DATA_FORMATTERS.formatPerformanceData(context.performance?.latest || context.performance || {});
    const goalsSection = DATA_FORMATTERS.formatGoals(context.goals);

    return template
      .replace('{rolePrompt}', rolePrompt)
      .replace('{userName}', context.user.name || 'Unknown')
      .replace('{userRole}', context.user.role || 'advisor')
      .replace('{userMarket}', context.user.market || 'Unknown Market')
      .replace('{userStore}', context.user.store || 'Unknown Store')
      .replace('{timeframe}', context.performance?.timeframe || context.timeframe || 'No data period specified')
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