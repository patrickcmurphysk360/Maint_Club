const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Database table for AI settings (we'll create this)
const createSettingsTable = async (pool) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value JSONB NOT NULL,
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_coaching_tips (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        trigger_conditions JSONB,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ AI settings tables ensured');
  } catch (error) {
    console.error('❌ Error creating AI settings tables:', error);
  }
};

// Get all AI settings
router.get('/config', async (req, res) => {
  try {
    // Only admins can view AI settings
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    await createSettingsTable(pool);

    // Get all settings from database
    const settingsResult = await pool.query(`
      SELECT setting_key, setting_value, updated_by, updated_at
      FROM ai_settings
      ORDER BY setting_key
    `);

    // Get current file-based config as fallback
    const { AI_AGENT_CONFIG, SYSTEM_PROMPTS, PROMPT_TEMPLATES } = require('../config/aiPrompts');
    
    // Convert database settings to object
    const dbSettings = {};
    settingsResult.rows.forEach(row => {
      dbSettings[row.setting_key] = {
        value: row.setting_value,
        updated_by: row.updated_by,
        updated_at: row.updated_at
      };
    });

    res.json({
      database_settings: dbSettings,
      default_config: {
        agent_config: AI_AGENT_CONFIG,
        system_prompts: SYSTEM_PROMPTS,
        prompt_templates: PROMPT_TEMPLATES
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching AI settings:', error);
    res.status(500).json({
      message: 'Error fetching AI settings',
      error: error.message
    });
  }
});

// Update system prompts
router.put('/prompts/system', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    const { base, advisor, manager, admin } = req.body;

    if (!base) {
      return res.status(400).json({ message: 'Base system prompt is required' });
    }

    const systemPrompts = {
      base: base,
      advisor: advisor || '',
      manager: manager || '',
      admin: admin || ''
    };

    // Save to database
    await pool.query(`
      INSERT INTO ai_settings (setting_key, setting_value, updated_by)
      VALUES ('system_prompts', $1, $2)
      ON CONFLICT (setting_key)
      DO UPDATE SET 
        setting_value = $1,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(systemPrompts), req.user.id]);

    console.log('🤖 System prompts updated by:', req.user.email);

    res.json({
      message: 'System prompts updated successfully',
      prompts: systemPrompts,
      updated_by: req.user.email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating system prompts:', error);
    res.status(500).json({
      message: 'Error updating system prompts',
      error: error.message
    });
  }
});

// Update AI agent configuration
router.put('/config/agent', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    const { 
      temperature, 
      top_k, 
      top_p, 
      num_predict, 
      defaultModel,
      timeout,
      maxContextTokens,
      maxResponseTokens 
    } = req.body;
    
    // Validate parameters
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ message: 'Temperature must be between 0 and 2' });
    }
    
    if (top_k !== undefined && (top_k < 1 || top_k > 100)) {
      return res.status(400).json({ message: 'top_k must be between 1 and 100' });
    }

    const agentConfig = {
      generation: {
        temperature: temperature || 0.1,
        top_k: top_k || 10,
        top_p: top_p || 0.3,
        num_predict: num_predict || 2048,
        timeout: timeout || 120000
      },
      models: {
        default: defaultModel || 'llama3.2:latest'
      },
      limits: {
        maxContextTokens: maxContextTokens || 8000,
        maxResponseTokens: maxResponseTokens || 1000
      }
    };

    // Save to database
    await pool.query(`
      INSERT INTO ai_settings (setting_key, setting_value, updated_by)
      VALUES ('agent_config', $1, $2)
      ON CONFLICT (setting_key)
      DO UPDATE SET 
        setting_value = $1,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(agentConfig), req.user.id]);

    console.log('🤖 AI agent config updated by:', req.user.email);
    
    res.json({
      message: 'AI agent configuration updated successfully',
      config: agentConfig,
      updated_by: req.user.email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating AI config:', error);
    res.status(500).json({
      message: 'Error updating AI configuration',
      error: error.message
    });
  }
});

// Get coaching tips
router.get('/coaching-tips', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    await createSettingsTable(pool);

    const { category, active } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (category) {
      whereClause += ' WHERE category = $1';
      params.push(category);
    }
    
    if (active !== undefined) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ` is_active = $${params.length + 1}`;
      params.push(active === 'true');
    }

    const result = await pool.query(`
      SELECT 
        id, category, title, content, trigger_conditions,
        is_active, created_by, created_at, updated_at,
        (SELECT email FROM users WHERE id = ct.created_by) as created_by_email
      FROM ai_coaching_tips ct
      ${whereClause}
      ORDER BY category, title
    `, params);

    res.json({
      tips: result.rows,
      total: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching coaching tips:', error);
    res.status(500).json({
      message: 'Error fetching coaching tips',
      error: error.message
    });
  }
});

// Create or update coaching tip
router.post('/coaching-tips', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    const { category, title, content, trigger_conditions, is_active = true } = req.body;

    if (!category || !title || !content) {
      return res.status(400).json({ 
        message: 'Category, title, and content are required' 
      });
    }

    const result = await pool.query(`
      INSERT INTO ai_coaching_tips 
      (category, title, content, trigger_conditions, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [category, title, content, trigger_conditions, is_active, req.user.id]);

    console.log('💡 Coaching tip created:', title, 'by:', req.user.email);

    res.json({
      message: 'Coaching tip created successfully',
      tip: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating coaching tip:', error);
    res.status(500).json({
      message: 'Error creating coaching tip',
      error: error.message
    });
  }
});

// Update coaching tip
router.put('/coaching-tips/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { category, title, content, trigger_conditions, is_active } = req.body;

    const result = await pool.query(`
      UPDATE ai_coaching_tips 
      SET 
        category = COALESCE($1, category),
        title = COALESCE($2, title),
        content = COALESCE($3, content),
        trigger_conditions = COALESCE($4, trigger_conditions),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [category, title, content, trigger_conditions, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Coaching tip not found' });
    }

    console.log('💡 Coaching tip updated:', id, 'by:', req.user.email);

    res.json({
      message: 'Coaching tip updated successfully',
      tip: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating coaching tip:', error);
    res.status(500).json({
      message: 'Error updating coaching tip',
      error: error.message
    });
  }
});

// Delete coaching tip
router.delete('/coaching-tips/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM ai_coaching_tips WHERE id = $1
      RETURNING title
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Coaching tip not found' });
    }

    console.log('💡 Coaching tip deleted:', result.rows[0].title, 'by:', req.user.email);

    res.json({
      message: 'Coaching tip deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting coaching tip:', error);
    res.status(500).json({
      message: 'Error deleting coaching tip',
      error: error.message
    });
  }
});

// Test AI prompt with live data
router.post('/test-prompt', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    const { promptType, customPrompt, testUserId, useCurrentSettings } = req.body;
    
    if (!promptType && !customPrompt) {
      return res.status(400).json({ message: 'Either promptType or customPrompt is required' });
    }

    const OllamaService = require('../services/ollamaService');
    const ollama = new OllamaService();

    let testContext;
    let finalPrompt;
    
    if (testUserId) {
      // Get real user data for testing
      const userResult = await pool.query(`
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
      `, [testUserId]);

      if (userResult.rows.length > 0) {
        const userData = userResult.rows[0];
        userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Test User';

        // Get performance data
        const performanceResult = await pool.query(`
          SELECT upload_date, data
          FROM performance_data
          WHERE advisor_user_id = $1 AND data_type = 'services'
          ORDER BY upload_date DESC
          LIMIT 1
        `, [testUserId]);

        // Get goals
        const goalsResult = await pool.query(`
          SELECT metric_name, target_value, period_type, goal_type
          FROM goals
          WHERE goal_type = 'advisor' AND advisor_user_id = $1
          ORDER BY effective_date DESC
        `, [testUserId]);

        testContext = ollama.buildPerformanceContext(
          userData,
          performanceResult.rows,
          goalsResult.rows
        );
      }
    }
    
    if (!testContext) {
      // Use mock context
      testContext = {
        user: { 
          name: 'Test User', 
          role: 'advisor', 
          market: 'Test Market', 
          store: 'Test Store' 
        },
        performance: { 
          sales: 1000, 
          invoices: 50, 
          oilChanges: 25, 
          alignments: 8,
          brakeService: 12
        },
        goals: [
          { metric_name: 'Oil Changes', target_value: 30, period_type: 'monthly' },
          { metric_name: 'Alignments', target_value: 10, period_type: 'monthly' }
        ],
        timeframe: new Date().toISOString()
      };
    }

    if (customPrompt) {
      finalPrompt = customPrompt;
    } else {
      if (promptType === 'chat') {
        finalPrompt = ollama.generatePerformancePrompt('How am I performing this month?', testContext);
      } else {
        finalPrompt = ollama.generateInsightPrompt(testContext, promptType);
      }
    }

    res.json({
      promptType,
      generatedPrompt: finalPrompt,
      contextUsed: testContext,
      testUserId: testUserId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error testing prompt:', error);
    res.status(500).json({
      message: 'Error testing prompt',
      error: error.message
    });
  }
});

// Get available models from Ollama
router.get('/models', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const OllamaService = require('../services/ollamaService');
    const ollama = new OllamaService();
    
    const isAvailable = await ollama.isAvailable();
    const models = isAvailable ? await ollama.getAvailableModels() : [];
    
    res.json({
      ollama_available: isAvailable,
      models: models.map(m => ({
        name: m.name || m,
        size: m.size || 'Unknown',
        modified_at: m.modified_at || null
      })),
      default_model: ollama.defaultModel,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching models:', error);
    res.status(500).json({
      message: 'Error fetching available models',
      error: error.message
    });
  }
});

module.exports = router;