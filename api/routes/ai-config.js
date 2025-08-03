const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Get current AI configuration
router.get('/config', async (req, res) => {
  try {
    // Only admins can view AI configuration
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const configPath = path.join(__dirname, '../config/aiPrompts.js');
    const configContent = await fs.readFile(configPath, 'utf8');
    
    // Parse the config (this is a simplified approach)
    const { AI_AGENT_CONFIG, SYSTEM_PROMPTS, PROMPT_TEMPLATES } = require('../config/aiPrompts');
    
    res.json({
      agentConfig: AI_AGENT_CONFIG,
      systemPrompts: SYSTEM_PROMPTS,
      promptTemplates: PROMPT_TEMPLATES,
      lastModified: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching AI config:', error);
    res.status(500).json({
      message: 'Error fetching AI configuration',
      error: error.message
    });
  }
});

// Update AI agent behavior settings
router.put('/config/agent', async (req, res) => {
  try {
    // Only admins can modify AI configuration
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { temperature, top_k, top_p, num_predict, defaultModel } = req.body;
    
    // Validate parameters
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ message: 'Temperature must be between 0 and 2' });
    }
    
    if (top_k !== undefined && (top_k < 1 || top_k > 100)) {
      return res.status(400).json({ message: 'top_k must be between 1 and 100' });
    }

    // This is a simplified approach - in production you'd want a proper config management system
    console.log('🤖 AI Config Update Request:', {
      temperature,
      top_k, 
      top_p,
      num_predict,
      defaultModel,
      updatedBy: req.user.email
    });

    // For now, just log the changes
    // You could implement actual file writing or database storage here
    
    res.json({
      message: 'AI configuration updated successfully',
      updatedSettings: {
        temperature,
        top_k,
        top_p, 
        num_predict,
        defaultModel
      },
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

// Test AI prompt with custom input
router.post('/test-prompt', async (req, res) => {
  try {
    // Only admins can test prompts
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { promptType, customPrompt, testContext } = req.body;
    
    if (!promptType && !customPrompt) {
      return res.status(400).json({ message: 'Either promptType or customPrompt is required' });
    }

    const OllamaService = require('../services/ollamaService');
    const ollama = new OllamaService();

    let finalPrompt;
    
    if (customPrompt) {
      // Direct custom prompt testing
      finalPrompt = customPrompt;
    } else {
      // Test existing prompt template
      const mockContext = testContext || {
        user: { name: 'Test User', role: 'advisor', market: 'Test Market', store: 'Test Store' },
        performance: { sales: 1000, invoices: 50, oilChanges: 25 },
        goals: [{ service_name: 'Oil Changes', target_value: 30, period: 'monthly' }],
        timeframe: new Date().toISOString()
      };

      if (promptType === 'chat') {
        finalPrompt = ollama.generatePerformancePrompt('How am I performing?', mockContext);
      } else {
        finalPrompt = ollama.generateInsightPrompt(mockContext, promptType);
      }
    }

    // Test the prompt without sending to AI (just return the generated prompt)
    res.json({
      promptType,
      generatedPrompt: finalPrompt,
      contextUsed: testContext,
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

// Get AI performance metrics and usage stats
router.get('/metrics', async (req, res) => {
  try {
    // Only admins can view metrics
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // This is a placeholder for AI usage metrics
    // You could implement actual metrics collection here
    res.json({
      metrics: {
        totalQueries: 0,
        avgResponseTime: 0,
        successRate: 0,
        popularQueryTypes: [],
        modelUsage: {},
        lastReset: new Date().toISOString()
      },
      note: 'Metrics collection not yet implemented'
    });
  } catch (error) {
    console.error('❌ Error fetching AI metrics:', error);
    res.status(500).json({
      message: 'Error fetching AI metrics',
      error: error.message
    });
  }
});

module.exports = router;