const axios = require('axios');
const { AI_AGENT_CONFIG, PROMPT_TEMPLATES, DATA_FORMATTERS } = require('../config/aiPrompts');
const AIDataService = require('./aiDataService');
const ScorecardFieldValidator = require('./scorecardFieldValidator');

class OllamaService {
  constructor(pool = null) {
    this.baseURL = process.env.OLLAMA_HOST || 'http://ollama:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || AI_AGENT_CONFIG.models.default;
    this.pool = pool;
    this.aiDataService = pool ? new AIDataService(pool) : null;
    this.scorecardValidator = new ScorecardFieldValidator(pool);
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

  async generateResponse(prompt, model = null, context = null, userId = null, query = null, contextData = null) {
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

        // SCORECARD VALIDATION: Validate response if needed
        if (userId && query && this.scorecardValidator.shouldValidate(query, contextData)) {
          console.log('🛡️ Validating AI response against scorecard field whitelist...');
          
          const validation = await this.scorecardValidator.validateResponse(
            response.data.response,
            userId,
            query,
            contextData
          );

          // Add validation metadata to response
          finalResponse.validation = {
            isValid: validation.isValid,
            violationCount: validation.violations.length,
            approvedFieldCount: validation.approvedFields.length
          };

          // Sanitize response if needed
          if (!validation.isValid) {
            console.warn(`⚠️ Response validation failed with ${validation.violations.length} violations`);
            finalResponse.response = this.scorecardValidator.sanitizeResponse(
              response.data.response,
              validation
            );
          } else {
            console.log(`✅ Response validation passed with ${validation.approvedFields.length} approved fields`);
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

        // SCORECARD VALIDATION: Validate response if needed
        if (userId && query && this.scorecardValidator.shouldValidate(query, contextData)) {
          console.log('🛡️ Validating AI response against scorecard field whitelist...');
          
          const validation = await this.scorecardValidator.validateResponse(
            response.data.message.content,
            userId,
            query,
            contextData
          );

          // Add validation metadata to response
          finalResponse.validation = {
            isValid: validation.isValid,
            violationCount: validation.violations.length,
            approvedFieldCount: validation.approvedFields.length
          };

          // Sanitize response if needed
          if (!validation.isValid) {
            console.warn(`⚠️ Response validation failed with ${validation.violations.length} violations`);
            finalResponse.message.content = this.scorecardValidator.sanitizeResponse(
              response.data.message.content,
              validation
            );
          } else {
            console.log(`✅ Response validation passed with ${validation.approvedFields.length} approved fields`);
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
          contextInfo += `

**AUTHORIZED PERFORMANCE METRICS:**
- Sales: $${scorecardData.sales?.toLocaleString() || 'N/A'}
- GP Sales: $${scorecardData.gpSales?.toLocaleString() || 'N/A'} (${scorecardData.gpPercent || 'N/A'}%)
- Invoices: ${scorecardData.invoices || 'N/A'}
- Alignments: ${scorecardData.alignments || 'N/A'}
- Oil Changes: ${scorecardData.oilChange || 'N/A'}
- Retail Tires: ${scorecardData.retailTires || 'N/A'}`;

          // Show advanced calculated metrics if available
          if (scorecardData.tpp) {
            contextInfo += `
- TPP (Tickets Per Pit): ${scorecardData.tpp} [CALCULATED BY SCORECARD SYSTEM]`;
          }
          
          if (scorecardData.pat) {
            contextInfo += `
- PAT (Parts Attach Rate): ${scorecardData.pat} [CALCULATED BY SCORECARD SYSTEM]`;
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
          contextInfo += `
**🚫 SCORECARD API ERROR:** ${validatedData.error}
Source: ${validatedData.metadata?.source || 'validated_scorecard_api'}
Policy Status: Data access attempted but failed`;
        } else {
          contextInfo += `
**🚫 SCORECARD DATA UNAVAILABLE:** No validated data retrieved
Policy Status: Performance query detected but no authorized data available`;
        }
      } else if (context.performance?.is_performance_query) {
        contextInfo += `
**🚫 POLICY VIOLATION:** Performance query detected but no policy-compliant data
Enforcement Level: ${context.performance?.enforcement_level || 'unknown'}
Raw Spreadsheet Access: ${context.performance?.raw_spreadsheet_access ? 'ENABLED (VIOLATION)' : 'DISABLED (COMPLIANT)'}`;
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
`**SPECIAL INSTRUCTION**: This is an organizational query. Focus on the employee information found in the ORGANIZATIONAL QUERY RESULTS section.` :
`Provide insights based on available information. For performance-related questions, direct users to ask specific performance queries that will trigger scorecard API usage.`}`;

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