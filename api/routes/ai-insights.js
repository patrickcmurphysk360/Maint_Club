const express = require('express');
const OllamaService = require('../services/ollamaService');

const router = express.Router();

// Debug endpoint (no auth required)
router.get('/debug', async (req, res) => {
  try {
    const ollama = new OllamaService();
    const isAvailable = await ollama.isAvailable();
    const models = isAvailable ? await ollama.getAvailableModels() : [];
    
    res.json({
      status: isAvailable ? 'healthy' : 'unavailable',
      ollama_available: isAvailable,
      models: models.map(m => m.name || m),
      timestamp: new Date().toISOString(),
      ollama_host: process.env.OLLAMA_HOST || 'http://ollama:11434'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for AI service
router.get('/health', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const ollama = new OllamaService(pool);
    const isAvailable = await ollama.isAvailable();
    const models = await ollama.getAvailableModels();
    
    res.json({
      status: isAvailable ? 'healthy' : 'unavailable',
      ollama_available: isAvailable,
      models: models.map(m => m.name || m),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Natural language query endpoint
router.post('/chat', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { query, userId, model } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    // Import user identification utility (V2 - improved version)
    const { identifyUserFromQuery } = require('../utils/userIdentificationV2');
    
    // Try to identify the user from the query if no specific userId provided
    let targetUserId = userId;
    if (!userId) {
      const identifiedUser = await identifyUserFromQuery(pool, query, req.user);
      targetUserId = identifiedUser.id;
      console.log(`🤖 AI identified target user: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${targetUserId})`);
    }
    
    // Permission check - advisors can only query their own data, admins can query anyone
    if (req.user.role === 'advisor' && targetUserId !== req.user.id) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    // Log admin access to other users' data
    if ((req.user.role === 'admin' || req.user.role === 'administrator') && targetUserId !== req.user.id) {
      console.log(`🔑 Admin ${req.user.email} accessing data for user ${targetUserId}`);
    }

    console.log(`🔍 AI Chat Query: "${query}" for user ${targetUserId}`);

    // Get user context
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
    `, [targetUserId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userResult.rows[0];
    
    // Build user display name
    userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User';

    // POLICY ENFORCEMENT: Use validated scorecard data instead of raw performance_data
    console.log('🛡️ POLICY COMPLIANCE: Using validated scorecard utility for performance data');
    const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
    
    // Parse date from query if present
    let mtdMonth = null;
    let mtdYear = null;
    
    // Check for month/year patterns in the query
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const queryLower = query.toLowerCase();
    
    // Look for month name and year
    monthNames.forEach((month, index) => {
      if (queryLower.includes(month)) {
        mtdMonth = index + 1;
        // Look for year after month
        const yearMatch = queryLower.match(new RegExp(month + '\\s+(\\d{4})'));
        if (yearMatch) {
          mtdYear = parseInt(yearMatch[1]);
        }
      }
    });
    
    // If no year found, use current year
    if (mtdMonth && !mtdYear) {
      mtdYear = new Date().getFullYear();
    }
    
    console.log(`📅 Detected date parameters from query: mtdMonth=${mtdMonth}, mtdYear=${mtdYear}`);
    
    let performanceResult = { rows: [] };
    try {
      const scorecardParams = { level: 'advisor', id: targetUserId };
      if (mtdMonth && mtdYear) {
        scorecardParams.mtdMonth = mtdMonth;
        scorecardParams.mtdYear = mtdYear;
      }
      
      console.log(`🔄 ADMIN SCORECARD REQUEST: ${JSON.stringify(scorecardParams)}`);
      const scorecardResult = await getValidatedScorecardData(scorecardParams);
      
      console.log(`📊 SCORECARD API RESPONSE: ${JSON.stringify({
        success: scorecardResult.success,
        hasData: !!scorecardResult.data,
        userId: scorecardResult.data?.userId,
        metricsCount: scorecardResult.data?.metrics ? Object.keys(scorecardResult.data.metrics).length : 0,
        servicesCount: scorecardResult.data?.services ? Object.keys(scorecardResult.data.services).length : 0,
        endpoint: scorecardResult.metadata?.endpoint,
        error: scorecardResult.error
      })}`);
      
      // Convert to legacy format for backward compatibility
      if (scorecardResult.success) {
        performanceResult.rows = [{
          upload_date: scorecardResult.metadata.retrievedAt,
          data: scorecardResult.data,
          store_id: null // Not available in validated scorecard format
        }];
        console.log('✅ ADMIN: Using complete validated scorecard data for AI insights');
      } else {
        console.error('❌ ADMIN: Scorecard API failed:', scorecardResult.error);
      }
    } catch (error) {
      console.error('⚠️ POLICY ENFORCEMENT: Could not get scorecard data:', error.message);
      // Leave performanceResult empty - do not fall back to raw data
    }

    // Get goals if available
    console.log('🎯 Querying goals for user:', targetUserId);
    const goalsResult = await pool.query(`
      SELECT metric_name, target_value, period_type, goal_type
      FROM goals
      WHERE goal_type = 'advisor' AND advisor_user_id = $1
      ORDER BY effective_date DESC
    `, [targetUserId]);
    console.log('🎯 Goals query completed, found:', goalsResult.rows.length, 'goals');

    // Initialize Ollama service with database pool
    const ollama = new OllamaService(pool);

    // Build enhanced context with all business intelligence
    // CRITICAL: Pass requesting user info for admin detection
    const context = await ollama.buildEnhancedContext(targetUserId, query);
    
    // Override user context with requesting user info for admin privileges
    context.user = {
      ...context.user,
      requestingUserId: req.user.id,
      requestingUserRole: req.user.role,
      requestingUserEmail: req.user.email,
      // For admin users, use admin role for prompt generation
      role: req.user.role === 'admin' || req.user.role === 'administrator' ? req.user.role : context.user.role
    };

    // Check if this is a scorecard query that needs JSON format
    const isSpecificScorecardQuery = context.performance?.is_specific_person_query && 
                                    context.performance?.validated_data?.success &&
                                    context.performance?.validated_data?.data;
    
    let prompt;
    let aiResponse;
    
    if (isSpecificScorecardQuery) {
      // Use JSON-only prompt for scorecard queries
      console.log('📊 Using JSON-only prompt for scorecard query');
      const scorecardData = context.performance.validated_data.data;
      const personName = context.performance.specific_person_name || context.user.name;
      const period = `${mtdYear || new Date().getFullYear()}-${String(mtdMonth || new Date().getMonth() + 1).padStart(2, '0')}`;
      
      // Build JSON prompt using AIDataService
      const aiDataService = ollama.aiDataService;
      prompt = aiDataService.buildScorecardJsonPrompt(personName, period, scorecardData);
      
      // Get AI response with temperature 0 for deterministic output
      const jsonResponse = await ollama.generateResponse(
        prompt, 
        model, 
        null, // context param
        targetUserId, // userId for validation
        query, // original query for validation
        context, // context data for validation
        { temperature: 0 } // Override temperature for JSON responses
      );
      
      if (jsonResponse.success) {
        try {
          // Validate the response matches source data
          const validatedData = aiDataService.validateScorecardResponse(jsonResponse.response, scorecardData);
          
          // Format the validated data into a human-readable response
          const formattedResponse = `**Scorecard for ${validatedData.advisor} in ${validatedData.period}**

* **Sales:** $${validatedData.sales.toLocaleString()}
* **GP Sales:** $${validatedData.gpSales.toLocaleString()}
* **GP Percent:** ${validatedData.gpPercent}%
* **Invoices:** ${validatedData.invoices}
* **Retail Tires:** ${validatedData.retailTires}
* **All Tires:** ${validatedData.allTires}`;
          
          aiResponse = {
            success: true,
            response: formattedResponse,
            model: jsonResponse.model,
            validation: { isValid: true, violationCount: 0 }
          };
        } catch (validationError) {
          console.error('❌ Scorecard validation failed:', validationError.message);
          aiResponse = {
            success: false,
            error: `Data validation failed: ${validationError.message}`
          };
        }
      } else {
        aiResponse = jsonResponse;
      }
    } else {
      // Use standard prompts for non-scorecard queries
      prompt = context.business_intelligence 
        ? ollama.generateEnhancedPrompt(query, context)
        : ollama.generatePerformancePrompt(query, context);

      // Get AI response WITH VALIDATION
      aiResponse = await ollama.generateResponse(
        prompt, 
        model, 
        null, // context param
        targetUserId, // userId for validation
        query, // original query for validation
        context // context data for validation
      );
    }

    if (!aiResponse.success) {
      return res.status(500).json({
        message: 'AI service error',
        error: aiResponse.error
      });
    }

    const responseData = {
      query: query,
      response: aiResponse.response,
      context_user: context.user.name,
      context_user_id: targetUserId,
      context_timeframe: context.performance?.timeframe || context.timeframe,
      context_type: context.business_intelligence ? 'enhanced' : 'basic',
      model_used: aiResponse.model,
      timestamp: new Date().toISOString(),
      query_about_different_user: targetUserId !== req.user.id
    };

    // Add validation metadata if available
    if (aiResponse.validation) {
      responseData.validation = {
        status: aiResponse.validation.isValid ? 'passed' : 'failed',
        violations: aiResponse.validation.violationCount,
        approved_fields: aiResponse.validation.approvedFieldCount
      };
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ AI Chat Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Generate automated insights for an advisor
router.get('/insights/advisor/:userId', async (req, res) => {
  try {
    console.log('🔍 AI Insights Request:', {
      userId: req.params.userId,
      type: req.query.type,
      model: req.query.model,
      userRole: req.user?.role
    });

    const pool = req.app.locals.pool;
    let { userId } = req.params;
    const { type = 'general', model } = req.query;

    // Handle 'current' userId
    if (userId === 'current') {
      userId = req.user.id.toString();
    }

    // Validate userId is a number
    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      console.error('❌ Invalid user ID:', userId);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Permission check - advisors can only view their own data, admins can view anyone
    if (req.user.role === 'advisor' && userIdNum !== req.user.id) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    // Log admin access to other users' data
    if ((req.user.role === 'admin' || req.user.role === 'administrator') && userIdNum !== req.user.id) {
      console.log(`🔑 Admin ${req.user.email} accessing insights for user ${userIdNum}`);
    }

    console.log(`📊 Generating ${type} insights for advisor ${userIdNum}`);

    // Get user and performance data (similar to chat endpoint)
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
    `, [userIdNum]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userResult.rows[0];
    
    // Build user display name
    userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User';

    // POLICY ENFORCEMENT: Use validated scorecard data instead of raw performance_data
    console.log('🛡️ POLICY COMPLIANCE: Using validated scorecard utility for insights');
    const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
    
    let performanceResult = { rows: [] };
    try {
      const scorecardResult = await getValidatedScorecardData({ level: 'advisor', id: userIdNum });
      
      // Convert to legacy format for backward compatibility
      if (scorecardResult.success) {
        performanceResult.rows = [{
          upload_date: scorecardResult.metadata.retrievedAt,
          data: scorecardResult.data
        }];
        console.log('✅ Using validated scorecard data for insights');
      }
    } catch (error) {
      console.error('⚠️ POLICY ENFORCEMENT: Could not get scorecard data:', error.message);
      // Leave performanceResult empty - do not fall back to raw data
    }

    if (performanceResult.rows.length === 0) {
      return res.json({
        insights: `No performance data available for ${userData.name}. This user may not be a service advisor or no data has been uploaded yet.`,
        user: userData.name,
        role: userData.role,
        timestamp: new Date().toISOString()
      });
    }

    // Get goals
    const goalsResult = await pool.query(`
      SELECT metric_name, target_value, period_type, goal_type
      FROM goals
      WHERE goal_type = 'advisor' AND advisor_user_id = $1
      ORDER BY effective_date DESC
    `, [userIdNum]);

    // Initialize Ollama service with database pool
    const ollama = new OllamaService(pool);
    
    // Build enhanced context for insights
    const context = await ollama.buildEnhancedContext(userIdNum);

    // Generate insights with enhanced context
    console.log('🤖 Generating enhanced insights for type:', type);
    const prompt = context.business_intelligence 
      ? ollama.generateEnhancedPrompt(`Generate ${type} insights and recommendations`, context)
      : ollama.generateInsightPrompt(context, type);
    console.log('📝 Prompt generated, calling AI...');
    
    const aiResponse = await ollama.generateResponse(prompt, model);
    console.log('🎯 AI Response:', { success: aiResponse.success, hasResponse: !!aiResponse.response });

    if (!aiResponse.success) {
      console.error('❌ AI Generation Failed:', aiResponse.error);
      return res.status(500).json({
        message: 'AI service error',
        error: aiResponse.error
      });
    }

    res.json({
      insights: aiResponse.response,
      type: type,
      user: context.user.name,
      data_period: context.performance?.timeframe || context.timeframe,
      context_type: context.business_intelligence ? 'enhanced' : 'basic',
      model_used: aiResponse.model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ AI Insights Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get available AI models
router.get('/models', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const ollama = new OllamaService(pool);
    const models = await ollama.getAvailableModels();
    res.json({
      models: models,
      default: ollama.defaultModel,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching models',
      error: error.message
    });
  }
});

// Dedicated scorecard endpoint for AI agent
router.post('/scorecard', async (req, res) => {
  console.log('[AI-INSIGHTS] Scorecard request body:', req.body);
  
  res.on('finish', () => {
    console.log('[AI-INSIGHTS] Scorecard response completed for period:', req.body.period, 'status:', res.statusCode);
  });
  
  try {
    const pool = req.app.locals.pool;
    const { advisorId, period } = req.body;
    
    console.log('[AI-INSIGHTS] Processing scorecard request:', { advisorId, period });
    
    if (!advisorId) {
      return res.status(400).json({ message: 'advisorId is required' });
    }

    // Permission check - advisors can only query their own data, admins can query anyone
    if (req.user.role === 'advisor' && parseInt(advisorId) !== req.user.id) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    // Log admin access to other users' data
    if ((req.user.role === 'admin' || req.user.role === 'administrator') && parseInt(advisorId) !== req.user.id) {
      console.log(`🔑 Admin ${req.user.email} accessing scorecard data for advisor ${advisorId}`);
    }

    // Get user info for display name
    const userResult = await pool.query(`
      SELECT id, first_name, last_name, email, role, status
      FROM users
      WHERE id = $1
    `, [advisorId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Advisor not found' });
    }

    const userData = userResult.rows[0];
    const advisorName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown Advisor';

    // Use scorecard API directly with period parameter
    console.log('[AI-INSIGHTS] Calling scorecard API with period:', period);
    
    const axios = require('axios');
    const jwt = require('jsonwebtoken');
    
    // Create service token for internal API calls
    const serviceToken = jwt.sign(
      { id: req.user.id, role: req.user.role, service: 'ai-insights' },
      process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
      { expiresIn: '5m' }
    );
    
    const baseURL = process.env.NODE_ENV === 'production' ? 'http://api:5000' : 'http://localhost:5002';
    
    const scorecardResponse = await axios.get(`${baseURL}/api/scorecard/advisor/${advisorId}`, {
      params: period ? { period } : {},
      headers: { 'Authorization': `Bearer ${serviceToken}` }
    });
    
    const scorecardData = scorecardResponse.data;
    console.log('[AI-INSIGHTS] Scorecard API returned:', {
      hasMetrics: !!scorecardData.metrics,
      hasServices: !!scorecardData.services,
      sales: scorecardData.metrics?.sales,
      invoices: scorecardData.metrics?.invoices
    });

    // Initialize AI service
    const ollama = new OllamaService(pool);
    const aiDataService = ollama.aiDataService;

    // Build JSON-only prompt
    const prompt = aiDataService.buildScorecardJsonPrompt(advisorName, period || 'current', scorecardData);
    
    console.log('[AI-INSIGHTS] Generated prompt for period:', period);
    console.dir({ periodInPrompt: period }, { depth: null });

    // Get AI response with temperature 0 for deterministic output
    const jsonResponse = await ollama.generateResponse(
      prompt, 
      null, // model (use default)
      null, // context param
      parseInt(advisorId), // userId for validation
      `scorecard for ${advisorName} ${period ? `for ${period}` : ''}`, // original query for validation
      { performance: { validated_data: { data: scorecardData } } }, // context data for validation
      { temperature: 0 } // Override temperature for JSON responses
    );
    
    if (jsonResponse.success) {
      try {
        // Validate the response matches source data
        const validatedData = aiDataService.validateScorecardResponse(jsonResponse.response, scorecardData);
        
        // Return the validated JSON data directly
        res.json(validatedData);
        
      } catch (validationError) {
        console.error('❌ Scorecard validation failed:', validationError.message);
        res.status(500).json({
          message: 'Data validation failed',
          error: validationError.message
        });
      }
    } else {
      console.error('❌ AI response failed:', jsonResponse.error);
      res.status(500).json({
        message: 'AI service error',
        error: jsonResponse.error
      });
    }

  } catch (error) {
    console.error('❌ AI Scorecard Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Store-level insights (for managers)
router.get('/insights/store/:storeId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId } = req.params;
    const { model } = req.query;

    // Permission check - only managers can access store insights
    if (!['admin', 'market_manager', 'store_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    console.log(`🏪 Generating store insights for store ${storeId}`);

    // Get store data and all advisors
    const storeResult = await pool.query(`
      SELECT s.*, m.name as market_name
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE s.id = $1
    `, [storeId]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Get all advisors in this store with recent performance
    const advisorResult = await pool.query(`
      SELECT 
        u.id, u.name,
        pd.upload_date, pd.data
      FROM users u
      JOIN performance_data pd ON u.id = pd.advisor_user_id
      WHERE u.store_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY u.name, pd.upload_date DESC
    `, [storeId]);

    if (advisorResult.rows.length === 0) {
      return res.json({
        insights: 'No recent performance data available for this store.',
        store: storeResult.rows[0].name,
        timestamp: new Date().toISOString()
      });
    }

    // Aggregate performance data for store-level analysis
    const storeData = {
      store: storeResult.rows[0],
      advisors: advisorResult.rows,
      advisor_count: new Set(advisorResult.rows.map(r => r.id)).size
    };

    // Initialize Ollama service with database pool
    const ollama = new OllamaService(pool);

    const prompt = `Analyze this store's performance data and provide insights:

Store: ${storeData.store.name} in ${storeData.store.market_name}
Total Advisors: ${storeData.advisor_count}

Recent Performance Data:
${JSON.stringify(storeData.advisors.slice(0, 10), null, 2)}

Provide:
1. Overall store performance summary
2. Top performing advisors
3. Areas needing improvement
4. Recommended actions for store management

Format as clear bullet points.`;

    const aiResponse = await ollama.generateResponse(prompt, model);

    if (!aiResponse.success) {
      return res.status(500).json({
        message: 'AI service error',
        error: aiResponse.error
      });
    }

    res.json({
      insights: aiResponse.response,
      store: storeData.store.name,
      advisor_count: storeData.advisor_count,
      model_used: aiResponse.model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Store Insights Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;