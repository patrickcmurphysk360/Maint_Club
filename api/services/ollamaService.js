const axios = require('axios');
const { AI_AGENT_CONFIG, PROMPT_TEMPLATES, DATA_FORMATTERS } = require('../config/aiPrompts');
const AIDataService = require('./aiDataService');
const ScorecardFieldValidator = require('./scorecardFieldValidator');
const AIValidationMiddleware = require('../middleware/aiValidationMiddleware');

class OllamaService {
  constructor(pool = null) {
    this.baseURL = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || AI_AGENT_CONFIG.models.default;
    this.pool = pool;
    this.aiDataService = pool ? new AIDataService(pool) : null;
    this.scorecardValidator = new ScorecardFieldValidator(pool);
    this.validationMiddleware = pool ? new AIValidationMiddleware(pool) : null;
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

  async generateResponse(prompt, model = null, context = null, userId = null, query = null, contextData = null, options = {}) {
    try {
      const requestModel = model || this.defaultModel;
      
      console.log(`🤖 Generating response with ${requestModel}...`);
      
      const payload = {
        model: requestModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature !== undefined ? options.temperature : AI_AGENT_CONFIG.generation.temperature,
          top_k: AI_AGENT_CONFIG.generation.top_k,
          top_p: AI_AGENT_CONFIG.generation.top_p,
          num_predict: AI_AGENT_CONFIG.generation.num_predict,
          repeat_penalty: AI_AGENT_CONFIG.generation.repeat_penalty || 1.1,
          seed: AI_AGENT_CONFIG.generation.seed
        }
      };

      if (context) {
        payload.context = context;
      }

      const response = await this.client.post('/api/generate', payload);
      
      if (response.data && response.data.response) {
        console.log(`✅ AI response generated (${response.data.response.length} chars)`);
        
        let finalResponse = {
          success: true,
          response: response.data.response,
          context: response.data.context,
          model: requestModel,
          done: response.data.done
        };

        // ADMIN OVERRIDE: Skip validation for authenticated admin users
        const isAdmin = contextData?.user?.role === 'admin' || contextData?.user?.role === 'administrator';
        if (userId && query && isAdmin) {
          console.log('🔓 ADMIN OVERRIDE: Skipping validation middleware for admin user');
          finalResponse.validation = { status: 'admin_override', adminAccess: true };
        } else if (userId && query && this.scorecardValidator.shouldValidate(query, contextData)) {
          console.log('🛡️ Running comprehensive AI response validation...');
          
          // Layer 1: Original field whitelist validation
          const fieldValidation = await this.scorecardValidator.validateResponse(
            response.data.response,
            userId,
            query,
            contextData
          );

          // Layer 2: New performance metrics validation middleware
          let metricValidation = null;
          if (this.validationMiddleware) {
            console.log('🎯 Running performance metrics validation against scorecard API...');
            metricValidation = await this.validationMiddleware.validateAIResponse(
              query,
              response.data.response,
              userId,
              contextData
            );
          }

          // Combine validation results
          const combinedValidation = {
            fieldValidation: {
              isValid: fieldValidation.isValid,
              violationCount: fieldValidation.violations.length,
              approvedFieldCount: fieldValidation.approvedFields.length
            },
            metricValidation: metricValidation ? {
              isValid: metricValidation.isValid,
              mismatchCount: metricValidation.mismatches.length,
              confidenceScore: metricValidation.confidenceScore,
              hasDisclaimer: !!metricValidation.disclaimer
            } : null,
            overallValid: fieldValidation.isValid && (!metricValidation || metricValidation.isValid)
          };

          finalResponse.validation = combinedValidation;

          // Apply corrections and disclaimers if needed
          let correctedResponse = response.data.response;

          // Apply field validation corrections first
          if (!fieldValidation.isValid) {
            console.warn(`⚠️ Field validation failed with ${fieldValidation.violations.length} violations`);
            correctedResponse = this.scorecardValidator.sanitizeResponse(
              correctedResponse,
              fieldValidation
            );
          }

          // Apply metric validation corrections and disclaimers
          if (metricValidation && !metricValidation.isValid) {
            console.warn(`⚠️ Metric validation failed with ${metricValidation.mismatches.length} mismatches (confidence: ${metricValidation.confidenceScore})`);
            correctedResponse = await this.validationMiddleware.rephraseResponse(
              correctedResponse,
              metricValidation
            );
          }

          finalResponse.response = correctedResponse;

          if (combinedValidation.overallValid) {
            console.log('✅ All validation layers passed successfully');
          } else {
            console.warn('⚠️ One or more validation layers failed - response has been corrected');
          }
        }

        return finalResponse;
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

  async chatCompletion(messages, model = null, userId = null, query = null, contextData = null) {
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
          top_p: AI_AGENT_CONFIG.generation.top_p,
          repeat_penalty: AI_AGENT_CONFIG.generation.repeat_penalty || 1.1,
          seed: AI_AGENT_CONFIG.generation.seed
        }
      };

      const response = await this.client.post('/api/chat', payload);
      
      if (response.data && response.data.message) {
        console.log(`✅ Chat response generated`);
        
        let finalResponse = {
          success: true,
          message: response.data.message,
          model: requestModel,
          done: response.data.done
        };

        // ENHANCED SCORECARD VALIDATION: Multiple validation layers (Chat)
        if (userId && query && this.scorecardValidator.shouldValidate(query, contextData)) {
          console.log('🛡️ Running comprehensive AI chat response validation...');
          
          // Layer 1: Original field whitelist validation
          const fieldValidation = await this.scorecardValidator.validateResponse(
            response.data.message.content,
            userId,
            query,
            contextData
          );

          // Layer 2: New performance metrics validation middleware
          let metricValidation = null;
          if (this.validationMiddleware) {
            console.log('🎯 Running chat performance metrics validation against scorecard API...');
            metricValidation = await this.validationMiddleware.validateAIResponse(
              query,
              response.data.message.content,
              userId,
              contextData
            );
          }

          // Combine validation results
          const combinedValidation = {
            fieldValidation: {
              isValid: fieldValidation.isValid,
              violationCount: fieldValidation.violations.length,
              approvedFieldCount: fieldValidation.approvedFields.length
            },
            metricValidation: metricValidation ? {
              isValid: metricValidation.isValid,
              mismatchCount: metricValidation.mismatches.length,
              confidenceScore: metricValidation.confidenceScore,
              hasDisclaimer: !!metricValidation.disclaimer
            } : null,
            overallValid: fieldValidation.isValid && (!metricValidation || metricValidation.isValid)
          };

          finalResponse.validation = combinedValidation;

          // Apply corrections and disclaimers if needed
          let correctedResponse = response.data.message.content;

          // Apply field validation corrections first
          if (!fieldValidation.isValid) {
            console.warn(`⚠️ Chat field validation failed with ${fieldValidation.violations.length} violations`);
            correctedResponse = this.scorecardValidator.sanitizeResponse(
              correctedResponse,
              fieldValidation
            );
          }

          // Apply metric validation corrections and disclaimers
          if (metricValidation && !metricValidation.isValid) {
            console.warn(`⚠️ Chat metric validation failed with ${metricValidation.mismatches.length} mismatches (confidence: ${metricValidation.confidenceScore})`);
            correctedResponse = await this.validationMiddleware.rephraseResponse(
              correctedResponse,
              metricValidation
            );
          }

          finalResponse.message.content = correctedResponse;

          if (combinedValidation.overallValid) {
            console.log('✅ All chat validation layers passed successfully');
          } else {
            console.warn('⚠️ One or more chat validation layers failed - response has been corrected');
          }
        }

        return finalResponse;
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
      
      // Check if this is a store ranking query
      if (query && this.aiDataService.isStoreRankingQuery(query)) {
        console.log('🏆 Detected store ranking query');
        
        // Extract metric from query
        let metric = 'alignments'; // default
        const metricMap = {
          'alignment': 'alignments',
          'oil change': 'oilChange',
          'tire': 'retailTires',
          'brake': 'brakeService'
        };
        
        for (const [keyword, metricName] of Object.entries(metricMap)) {
          if (query.toLowerCase().includes(keyword)) {
            metric = metricName;
            break;
          }
        }
        
        // Extract month/year from query
        const monthMatch = query.match(/august|aug|8/i);
        const yearMatch = query.match(/2025|2024|2023/);
        const month = monthMatch ? 8 : new Date().getMonth() + 1;
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
        
        // Get store rankings
        const rankingsResult = await this.aiDataService.getStoreRankings(metric, month, year);
        
        if (rankingsResult.success) {
          // Build context with ranking data
          const context = await this.aiDataService.buildComprehensiveContext(userId, query);
          context.storeRankings = rankingsResult.data;
          context.queryType = 'store_rankings';
          console.log('✅ Enhanced context with store rankings built successfully');
          return context;
        }
      }
      
      // Standard context building
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

      // POLICY ENFORCEMENT: Use validated scorecard utility instead of raw data
      console.log('🎯 Basic context builder enforcing scorecard API policy');
      const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
      
      let performanceResult = { rows: [] };
      try {
        const scorecardResult = await getValidatedScorecardData({ level: 'advisor', id: userId });
        
        // Convert to legacy format for backward compatibility
        performanceResult.rows = [{
          upload_date: scorecardResult.metadata.retrievedAt,
          data: scorecardResult.data,
          store_id: null, // Not available in scorecard format
          store_name: userData.store_name,
          market_name: userData.market_name
        }];
        
        console.log('✅ Basic context using validated scorecard data');
      } catch (error) {
        console.error('⚠️ POLICY ENFORCEMENT: Could not get scorecard data for basic context:', error.message);
        // Leave performanceResult empty - do not fall back to raw data
      }

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
          market: userData.market_name || userData.market,
          store: userData.store_name || userData.store
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
      // Admin scorecard-specific handling
      const isAdmin = context.user?.role === 'admin' || context.user?.role === 'administrator';
      const isPerformanceQuery = context.performance?.is_performance_query;
      
      // Use admin scorecard prompt for admin users with performance queries
      if (isAdmin && isPerformanceQuery && context.performance?.validated_data) {
        return this.generateAdminScorecardPrompt(query, context);
      }
      
      // Handle store ranking queries specially
      if (context.queryType === 'store_rankings' && context.storeRankings) {
        const rankings = context.storeRankings;
        let prompt = `You are asked: "${query}"

VALIDATED SCORECARD DATA - Store Rankings for ${rankings.metric} (${rankings.period.month}/${rankings.period.year}):

`;
        rankings.rankings.forEach(store => {
          prompt += `${store.rank}. ${store.storeName} (${store.marketName}): ${store.metricValue} ${rankings.metric} (${store.advisorCount} advisors)\n`;
        });
        
        prompt += `\nTotal stores ranked: ${rankings.totalStores}
Data source: Official scorecard API endpoints
Last updated: ${rankings.lastUpdated}

Please provide a clear answer about the store rankings based on this validated scorecard data.`;
        
        return prompt;
      }
      
      const rolePrompt = DATA_FORMATTERS.getRolePrompt(context.user.role);
      
      // Build comprehensive context information
      let contextInfo = `
**USER PROFILE:**
- Name: ${context.user.name || 'Unknown'}
- Role: ${context.user.role || 'advisor'}
- Market: ${context.user.market || 'Unknown Market'}
- Store: ${context.user.store || 'Unknown Store'}

**PERFORMANCE DATA:**`;

      // POLICY ENFORCEMENT: Use ONLY validated scorecard data from authorized endpoints
      if (context.performance?.is_performance_query && context.performance?.policy_compliant) {
        const validatedData = context.performance.validated_data;
        
        if (validatedData && validatedData.success && validatedData.data) {
          contextInfo += `
**🔒 POLICY-COMPLIANT SCORECARD DATA**`;
          
          if (context.performance.is_specific_person_query) {
            contextInfo += `
Target: ${context.performance.specific_person_name?.toUpperCase() || 'UNKNOWN'}
Source: ${validatedData.metadata.source} 
Endpoint: ${validatedData.metadata.endpoint}
Retrieved: ${new Date(validatedData.metadata.retrievedAt).toLocaleDateString()}
Data Integrity: ${validatedData.metadata.dataIntegrity}`;
          } else {
            contextInfo += `
Source: ${validatedData.metadata.source}
Endpoint: ${validatedData.metadata.endpoint}  
Retrieved: ${new Date(validatedData.metadata.retrievedAt).toLocaleDateString()}
Data Integrity: ${validatedData.metadata.dataIntegrity}`;
          }
            
          const scorecardData = validatedData.data;
          const metrics = scorecardData.metrics || {};
          const services = scorecardData.services || {};
          
          // Admin users get raw data without placeholders
          const isAdmin = context.user?.role === 'admin' || context.user?.role === 'administrator';
          
          if (isAdmin) {
            contextInfo += `

**🔒 ADMIN COMPLETE SCORECARD DATA:**`;
            
            // Only show metrics that actually exist - no placeholders
            if (metrics.sales !== undefined && metrics.sales !== null) {
              contextInfo += `\n- **Sales**: $${metrics.sales.toLocaleString()}`;
            }
            if (metrics.gpSales !== undefined && metrics.gpSales !== null) {
              contextInfo += `\n- **GP Sales**: $${metrics.gpSales.toLocaleString()}`;
              if (metrics.gpPercent !== undefined && metrics.gpPercent !== null) {
                contextInfo += ` (${metrics.gpPercent}%)`;
              }
            }
            if (metrics.invoices !== undefined && metrics.invoices !== null) {
              contextInfo += `\n- **Invoices**: ${metrics.invoices}`;
            }
            
            // Services - only show if they exist
            Object.entries(services).forEach(([serviceName, value]) => {
              if (value !== undefined && value !== null) {
                contextInfo += `\n- **${serviceName}**: ${value}`;
              }
            });
            
            // Average spend only if both values exist
            if (metrics.sales && metrics.invoices) {
              contextInfo += `\n- **Average Spend**: $${(metrics.sales / metrics.invoices).toFixed(2)}`;
            }
          } else {
            // Non-admin users get the original format with N/A placeholders
            contextInfo += `

**🔒 ADMIN COMPLETE SCORECARD DATA:**
- **Sales**: $${metrics.sales?.toLocaleString() || 'N/A'}
- **GP Sales**: $${metrics.gpSales?.toLocaleString() || 'N/A'} (${metrics.gpPercent || 'N/A'}%)
- **Invoices**: ${metrics.invoices || 'N/A'}
- **Alignments**: ${services['Alignments'] || 'N/A'}
- **Oil Changes**: ${services['Oil Change'] || 'N/A'}
- **Retail Tires**: ${services['Retail Tires'] || 'N/A'}
- **All Tires**: ${services['All Tires'] || 'N/A'}
- **Brake Service**: ${services['Brake Service'] || 'N/A'}
- **Tire Protection**: ${services['Tire Protection'] || 'N/A'} (${services['Tire Protection %'] || 'N/A'}%)
- **Tire Balance**: ${services['Tire Balance'] || 'N/A'}
- **Brake Flush**: ${services['Brake Flush'] || 'N/A'}
- **Engine Air Filter**: ${services['Engine Air Filter'] || 'N/A'}
- **Cabin Air Filter**: ${services['Cabin Air Filter'] || 'N/A'}
- **Coolant Flush**: ${services['Coolant Flush'] || 'N/A'}
- **Shocks & Struts**: ${services['Shocks & Struts'] || 'N/A'}
- **Average Spend**: $${(metrics.sales && metrics.invoices ? (metrics.sales / metrics.invoices).toFixed(2) : 'N/A')}`;
          }

          // Show advanced calculated metrics if available
          if (isAdmin) {
            // Admin: Only show if all required data exists
            if (services['Potential Alignments %'] !== undefined && services['Potential Alignments %'] !== null) {
              contextInfo += `\n- **Potential Alignments %**: ${services['Potential Alignments %']}%`;
              if (services['Potential Alignments Sold'] !== undefined && services['Potential Alignments'] !== undefined) {
                contextInfo += ` (${services['Potential Alignments Sold']}/${services['Potential Alignments']})`;
              }
            }
            
            if (services['Brake Flush to Service %'] !== undefined && services['Brake Flush to Service %'] !== null) {
              contextInfo += `\n- **Brake Flush to Service %**: ${services['Brake Flush to Service %']}%`;
            }
          } else {
            // Non-admin: Original format with N/A
            if (services['Potential Alignments %']) {
              contextInfo += `
- **Potential Alignments %**: ${services['Potential Alignments %']}% (${services['Potential Alignments Sold'] || 'N/A'}/${services['Potential Alignments'] || 'N/A'})`;
            }
            
            if (services['Brake Flush to Service %']) {
              contextInfo += `
- **Brake Flush to Service %**: ${services['Brake Flush to Service %']}%`;
            }
          }
          
          // Show goals if available
          if (scorecardData.goals && Object.keys(scorecardData.goals).length > 0) {
            contextInfo += `

**CURRENT GOALS:**`;
            Object.entries(scorecardData.goals).forEach(([metric, goal]) => {
              contextInfo += `
- **${metric}**: Target ${goal.target} (${goal.periodType})`;
            });
          }
          
          if (scorecardData.fluid_attach_rates || scorecardData.fluidAttachRates) {
            const fluidRates = scorecardData.fluid_attach_rates || scorecardData.fluidAttachRates;
            contextInfo += `
- Fluid Attach Rates: ${JSON.stringify(fluidRates)} [CALCULATED BY SCORECARD SYSTEM]`;
          }
          
          if (scorecardData.vendorMapping) {
            contextInfo += `
- Vendor Mappings: Available [FROM SCORECARD SYSTEM]`;
          }
          
        } else if (validatedData && !validatedData.success) {
          if (isAdmin) {
            // Admin: Raw error info only
            contextInfo += `\n**Scorecard API Error**: ${validatedData.error}`;
            if (validatedData.metadata?.endpoint) {
              contextInfo += `\nEndpoint: ${validatedData.metadata.endpoint}`;
            }
          } else {
            // Non-admin: Full error messaging
            contextInfo += `
**❌ ADMIN ERROR - API FAILURE:** ${validatedData.error}
Endpoint: ${validatedData.metadata?.endpoint || 'Unknown'}
Admin Override: Contact system administrator immediately`;
          }
        } else {
          if (isAdmin) {
            // Admin: Simple no data message
            contextInfo += `\n**No scorecard data available**`;
          } else {
            // Non-admin: Full error messaging
            contextInfo += `
**❌ ADMIN ERROR - NO DATA:** Scorecard API returned no data
Expected: Complete advisor scorecard with all metrics
Admin Override: Verify API connectivity and user permissions`;
          }
        }
      } else if (context.performance?.is_performance_query) {
        if (!isAdmin) {
          // Only show policy violation for non-admin users
          contextInfo += `
**🚫 POLICY VIOLATION:** Performance query detected but no policy-compliant data
Enforcement Level: ${context.performance?.enforcement_level || 'unknown'}
Raw Spreadsheet Access: ${context.performance?.raw_spreadsheet_access ? 'ENABLED (VIOLATION)' : 'DISABLED (COMPLIANT)'}`;
        }
      } else {
        contextInfo += `
**PERFORMANCE DATA:** Not a performance-related query - no scorecard access required`;
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

        // Only show market performance data if NOT a specific person query (to avoid confusion)
        if (bi.market_performance && bi.market_performance.length > 0 && !context.performance?.is_specific_person_query) {
          const isAdmin = context.user?.role === 'admin' || context.user?.role === 'administrator';
          contextInfo += `

**MARKET PERFORMANCE DATA (Latest MTD Spreadsheet):**`;
          bi.market_performance.slice(0, 3).forEach(perf => {
            const uploadMonth = new Date(perf.upload_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            if (isAdmin) {
              // Admin: Only show actual values
              contextInfo += `\n- ${perf.market_name} - ${uploadMonth} MTD:`;
              if (perf.total_sales !== undefined && perf.total_sales !== null) {
                contextInfo += ` $${perf.total_sales.toLocaleString()} total sales`;
              }
              if (perf.advisor_count !== undefined && perf.advisor_count !== null) {
                contextInfo += `, ${perf.advisor_count} advisors`;
              }
              if (perf.avg_gp_percent !== undefined && perf.avg_gp_percent !== null) {
                contextInfo += `, ${perf.avg_gp_percent.toFixed(1)}% avg GP`;
              }
            } else {
              // Non-admin: Original with N/A
              contextInfo += `
- ${perf.market_name} - ${uploadMonth} MTD: $${perf.total_sales?.toLocaleString() || 'N/A'} total sales, ${perf.advisor_count} advisors, ${perf.avg_gp_percent?.toFixed(1) || 'N/A'}% avg GP`;
            }
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
        const isAdmin = context.user?.role === 'admin' || context.user?.role === 'administrator';
        contextInfo += `

**TOP PERFORMERS (Latest MTD):**`;
        context.benchmarking.top_performers.forEach((performer, index) => {
          if (isAdmin) {
            // Admin: Only show actual values
            contextInfo += `\n${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value} units`;
            if (performer.total_sales !== undefined && performer.total_sales !== null) {
              contextInfo += ` - $${performer.total_sales.toLocaleString()} total sales`;
            }
          } else {
            // Non-admin: Original with N/A
            contextInfo += `
${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value} units - $${performer.total_sales?.toLocaleString() || 'N/A'} total sales`;
          }
        });
      }

      // Add organizational context
      if (context.organizational?.is_org_query && context.organizational.query_specific_data) {
        contextInfo += `

**ORGANIZATIONAL QUERY RESULTS:**`;
        const orgData = context.organizational.query_specific_data;
        if (orgData.length > 0) {
          // Check if this is store history data (has performance_records field)
          const isStoreHistory = orgData[0].performance_records !== undefined;
          
          if (isStoreHistory) {
            contextInfo += `
Found store assignment history for ${orgData.length} location(s):`;
            orgData.slice(0, 10).forEach(assignment => {
              const empName = `${assignment.first_name} ${assignment.last_name}`;
              const storeName = assignment.store_name || 'Unknown Store';
              const marketName = assignment.market_name || 'Unknown Market';
              const assignedDate = assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'Unknown';
              const perfRecords = assignment.performance_records || 0;
              contextInfo += `
- ${empName} worked at ${storeName} (${marketName}) - Assigned: ${assignedDate} - ${perfRecords} performance records`;
            });
          } else {
            contextInfo += `
Found ${orgData.length} matching employee(s):`;
            orgData.slice(0, 10).forEach(emp => {
              const empName = `${emp.first_name} ${emp.last_name}`;
              const empRole = emp.role || 'N/A';
              const empStore = emp.store_name || 'Unassigned';
              const empMarket = emp.market_name || 'N/A';
              contextInfo += `
- ${empName} (${empRole}) - ${empStore} store, ${empMarket} market`;
            });
          }
          if (orgData.length > 10) {
            contextInfo += `
... and ${orgData.length - 10} more employees`;
          }
        } else {
          contextInfo += `
No matching employees found for the query.`;
        }
      } else if (context.organizational?.structure && context.organizational.structure.length > 0) {
        // Show general org structure context
        const orgStructure = context.organizational.structure;
        const roleGroups = {};
        orgStructure.forEach(emp => {
          if (!roleGroups[emp.role]) roleGroups[emp.role] = 0;
          roleGroups[emp.role]++;
        });
        
        contextInfo += `

**ORGANIZATIONAL STRUCTURE CONTEXT:**`;
        Object.entries(roleGroups).forEach(([role, count]) => {
          contextInfo += `
- ${count} ${role}${count !== 1 ? 's' : ''}`;
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

CRITICAL PERFORMANCE DATA RULES:
1. **SCORECARD API ONLY**: All performance metrics (TPP, PAT, fluid attach rates, sales, etc.) MUST come from validated scorecard API endpoints. Never infer, calculate, or approximate these values.

2. **Single Source of Truth**: Use ONLY these endpoints for performance data:
   - /api/scorecard/advisor/:userId
   - /api/scorecard/store/:storeId  
   - /api/scorecard/market/:marketId

3. **No Raw Spreadsheet Data**: Never reference or use raw MTD spreadsheet data for performance metrics. Always use the validated scorecard data shown in the VALIDATED SCORECARD DATA section above.

4. **Performance Query Detection**: If this is marked as a performance query (is_performance_query: true), you MUST use only the validated scorecard data provided.

ADDITIONAL GUIDELINES:
5. **Top Performer Queries**: When asked about "top advisors", use the TOP PERFORMERS section with validated data.

6. **Organizational Questions**: Use the ORGANIZATIONAL QUERY RESULTS section for employee information.

7. **People Recognition**: Always use full names and specific roles when referring to employees.

${context.performance?.is_performance_query ? 
`**CRITICAL**: This is a PERFORMANCE QUERY. You MUST use ONLY the VALIDATED SCORECARD DATA shown above. Do not infer, calculate, or reference any other performance metrics. If the validated data shows an error, inform the user that scorecard data is unavailable.` :
context.performance?.is_specific_person_query ? 
`**SPECIAL INSTRUCTION**: This is a query about a specific person's performance using VALIDATED SCORECARD DATA. Provide a direct, objective summary of the validated scorecard metrics shown above.` :
context.benchmarking?.is_top_performer_query ? 
`**SPECIAL INSTRUCTION**: This is a top performer query. Focus on the rankings and performance metrics found in the TOP PERFORMERS section.` :
context.organizational?.is_org_query ? 
`**SPECIAL INSTRUCTION - ADMIN ORGANIZATIONAL QUERY**: This is an organizational query from an admin user. Provide a DIRECT, COMPLETE response without deflection.

**RESPONSE FORMAT REQUIREMENTS:**
- For advisor listings: Use format "Advisors at [Store Name]:" followed by bullet points
- Include full names: "• [First Name] [Last Name] ([role])"
- If no advisors found: "No advisors were found for the store '[Store Name]'. Please verify the store name and try again."
- If store not found: "No store found with the name '[Store Name]'. Please double-check the spelling."
- NO "check with HR" or deflection messages
- Provide the complete list from the ORGANIZATIONAL QUERY RESULTS section` :
`Provide insights based on available information. For performance-related questions, direct users to ask specific performance queries that will trigger scorecard API usage.`}`;

      return enhancedTemplate;

    } catch (error) {
      console.error('❌ Error generating enhanced prompt:', error);
      // Fall back to basic prompt
      return this.generatePerformancePrompt(query, context);
    }
  }

  formatAdminScorecardData(scorecardData) {
    if (!scorecardData) {
      return 'null';
    }

    const formatted = {
      advisor: scorecardData.advisor,
      month: scorecardData.month,
      store: scorecardData.store,
      metrics: {},
      services: {},
      goals: {},
      _dataTypes: {
        note: "CRITICAL: Retail Tires and All Tires are UNIT COUNTS, not currency. Format as '228 units' NOT '$228'",
        unitFields: ["Retail Tires", "All Tires", "Oil Change", "Alignments", "Brake Service", "Invoices"],
        currencyFields: ["Sales", "GP Sales"],
        percentageFields: ["GP Percent", "Tire Protection %"]
      }
    };

    // Include full metrics structure with "Data not available" for missing keys
    const expectedMetrics = ['sales', 'gpSales', 'gpPercent', 'invoices'];
    expectedMetrics.forEach(key => {
      if (scorecardData.metrics && scorecardData.metrics[key] !== undefined && scorecardData.metrics[key] !== null) {
        formatted.metrics[key] = scorecardData.metrics[key];
      } else {
        formatted.metrics[key] = "Data not available";
      }
    });

    // Include additional metrics that exist
    if (scorecardData.metrics) {
      Object.entries(scorecardData.metrics).forEach(([key, value]) => {
        if (!expectedMetrics.includes(key) && value !== null && value !== undefined) {
          formatted.metrics[key] = value;
        }
      });
    }

    // Include full services structure with "Data not available" for missing keys
    const expectedServices = ['Oil Change', 'Alignments', 'Retail Tires', 'All Tires', 'Brake Service', 'Tire Protection', 'Brake Flush', 'Engine Air Filter', 'Cabin Air Filter'];
    expectedServices.forEach(key => {
      if (scorecardData.services && scorecardData.services[key] !== undefined && scorecardData.services[key] !== null) {
        formatted.services[key] = scorecardData.services[key];
      } else {
        formatted.services[key] = "Data not available";
      }
    });

    // Include additional services that exist
    if (scorecardData.services) {
      Object.entries(scorecardData.services).forEach(([key, value]) => {
        if (!expectedServices.includes(key) && value !== null && value !== undefined) {
          formatted.services[key] = value;
        }
      });
    }

    // Copy goals as-is (only include what exists)
    if (scorecardData.goals) {
      Object.entries(scorecardData.goals).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Flatten goal objects to simple target values for cleaner JSON
          if (typeof value === 'object' && value.target !== undefined) {
            formatted.goals[key] = value.target;
          } else {
            formatted.goals[key] = value;
          }
        }
      });
    }

    try {
      return JSON.stringify(formatted, null, 2);
    } catch (error) {
      console.error('❌ Error formatting admin scorecard data to JSON:', error);
      return 'null';
    }
  }

  generateAdminScorecardPrompt(query, context) {
    const { PROMPT_TEMPLATES, DATA_FORMATTERS, formatMetric } = require('../config/aiPrompts');
    
    // Extract scorecard data from validated performance data
    const validatedData = context.performance?.validated_data;
    
    console.log('🔍 ADMIN PROMPT DEBUG:');
    console.log('   validatedData exists:', !!validatedData);
    console.log('   validatedData.success:', validatedData?.success);
    console.log('   validatedData.data exists:', !!validatedData?.data);
    if (validatedData?.data) {
      console.log('   validatedData.data keys:', Object.keys(validatedData.data));
      console.log('   validatedData.data.metrics:', JSON.stringify(validatedData.data.metrics || {}, null, 2));
    }
    
    if (!validatedData || !validatedData.success || !validatedData.data) {
      console.log('❌ ADMIN PROMPT: No validated data - returning "no data" message');
      // No data available - use admin template with explicit null and stricter instructions
      return PROMPT_TEMPLATES.adminScorecard.template
        .replace('{scorecardData}', 'null')
        .replace('{userQuery}', query + '\n\nIMPORTANT: The scorecardData object is null. You MUST respond with the exact message: "⚠️ No validated scorecard data was found for this advisor." DO NOT fabricate any numbers.');
    }
    
    // Format scorecard data for admin consumption - preserve original structure
    const scorecardData = {
      advisor: context.performance?.specific_person_name || validatedData.data.advisorName || context.user?.name || 'Unknown',
      month: validatedData.data.month || validatedData.data.period || 'Current',
      store: validatedData.data.store || validatedData.data.storeName || context.user?.store || 'Unknown',
      metrics: {},
      services: {},
      goals: {}
    };
    
    // Copy metrics if present (sales, gpSales, invoices, etc.)
    if (validatedData.data.metrics) {
      Object.entries(validatedData.data.metrics).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          scorecardData.metrics[key] = value;
        }
      });
    }
    
    // Copy services separately with original keys (Oil Change, Alignments, etc.)
    if (validatedData.data.services) {
      Object.entries(validatedData.data.services).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          scorecardData.services[key] = value;
        }
      });
    }
    
    // Copy goals if present
    if (validatedData.data.goals) {
      Object.entries(validatedData.data.goals).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          scorecardData.goals[key] = value;
        }
      });
    }
    
    // Format the complete scorecard data
    const formattedData = this.formatAdminScorecardData(scorecardData);
    
    return PROMPT_TEMPLATES.adminScorecard.template
      .replace('{scorecardData}', formattedData)
      .replace('{userQuery}', query);
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