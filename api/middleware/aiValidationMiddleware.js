/**
 * AI Response Validation Middleware
 * 
 * Intercepts performance-related AI responses, fetches expected values from 
 * /api/scorecard/... endpoints, and validates accuracy. Logs mismatches for audit.
 * 
 * CRITICAL: This middleware enforces scorecard API policy by comparing AI responses
 * against authoritative data sources and flagging inconsistencies.
 */

const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
const ScorecardFieldValidator = require('../services/scorecardFieldValidator');

class AIValidationMiddleware {
  constructor(pool) {
    this.pool = pool;
    this.validator = new ScorecardFieldValidator(pool);
    
    // Performance metrics that require numerical validation
    this.numericMetrics = {
      'sales': { tolerance: 0.01, type: 'currency' },
      'gpSales': { tolerance: 0.01, type: 'currency' },
      'gpPercent': { tolerance: 0.1, type: 'percentage' },
      'invoices': { tolerance: 0, type: 'integer' },
      'alignments': { tolerance: 0, type: 'integer' },
      'oilChange': { tolerance: 0, type: 'integer' },
      'retailTires': { tolerance: 0, type: 'integer' },
      'brakeService': { tolerance: 0, type: 'integer' },
      'tpp': { tolerance: 0.01, type: 'decimal' },
      'pat': { tolerance: 0.01, type: 'decimal' }
    };
    
    // Patterns to detect performance metrics in AI responses
    this.metricPatterns = {
      sales: /\$?[\d,]+\.?\d*\s*(?:in\s+)?(?:total\s+)?sales?/gi,
      gpSales: /\$?[\d,]+\.?\d*\s*(?:in\s+)?(?:gross\s+profit|gp)\s*(?:sales?)?/gi,
      gpPercent: /[\d.]+%?\s*(?:gross\s+profit|gp)\s*(?:percentage?|%)/gi,
      invoices: /[\d,]+\s*(?:invoices?|tickets?)/gi,
      alignments: /[\d,]+\s*alignments?/gi,
      oilChange: /[\d,]+\s*oil\s*changes?/gi,
      retailTires: /[\d,]+\s*(?:retail\s+)?tires?/gi,
      brakeService: /[\d,]+\s*brake\s*services?/gi,
      tpp: /[\d.]+\s*(?:tickets?\s+per\s+pit|tpp)/gi,
      pat: /[\d.]+\s*(?:parts?\s+attach\s+rate|pat)/gi
    };
    
    console.log('✅ AI Validation Middleware initialized');
  }

  /**
   * Main validation middleware function
   * Intercepts AI responses and validates performance metrics
   */
  async validateAIResponse(query, aiResponse, userId, contextData = null) {
    try {
      console.log('🔍 AI Validation Middleware: Starting validation');
      
      const validationResult = {
        isValid: true,
        mismatches: [],
        expectedValues: {},
        detectedValues: {},
        confidenceScore: 1.0,
        disclaimer: null,
        auditLog: {
          timestamp: new Date().toISOString(),
          userId: userId,
          query: query,
          validationType: 'performance_metric_validation'
        }
      };

      // Check if this is a performance-related query
      if (!this.isPerformanceQuery(query)) {
        console.log('🔍 Non-performance query detected, skipping metric validation');
        return validationResult;
      }

      // Extract entity information from query/context
      const entityInfo = this.extractEntityInfo(query, userId, contextData);
      
      if (entityInfo) {
        console.log(`🎯 Validating against ${entityInfo.level} ID: ${entityInfo.id}`);
        
        // Fetch expected values from scorecard API
        const expectedData = await this.fetchExpectedValues(entityInfo);
        validationResult.expectedValues = expectedData;
        
        // Extract metrics from AI response
        const detectedMetrics = this.extractMetricsFromResponse(aiResponse);
        validationResult.detectedValues = detectedMetrics;
        
        // Compare values and detect mismatches
        const mismatches = this.compareMetrics(expectedData, detectedMetrics);
        validationResult.mismatches = mismatches;
        
        if (mismatches.length > 0) {
          validationResult.isValid = false;
          validationResult.confidenceScore = this.calculateConfidenceScore(mismatches);
          validationResult.disclaimer = this.generateDisclaimer(mismatches);
          
          console.warn(`⚠️ AI Response Validation Failed: ${mismatches.length} mismatches detected`);
        } else {
          console.log('✅ AI Response Validation Passed: All metrics accurate');
        }
      }

      // Log validation results for audit
      await this.logValidationResult(validationResult);
      
      return validationResult;
      
    } catch (error) {
      console.error('❌ AI Validation Middleware Error:', error);
      
      const errorResult = {
        isValid: false,
        mismatches: [{
          type: 'validation_error',
          severity: 'high',
          message: `Validation failed: ${error.message}`,
          field: 'system_error'
        }],
        expectedValues: {},
        detectedValues: {},
        confidenceScore: 0.0,
        disclaimer: 'Unable to validate response accuracy. Please verify data independently.',
        auditLog: {
          timestamp: new Date().toISOString(),
          userId: userId,
          query: query,
          error: error.message,
          validationType: 'performance_metric_validation'
        }
      };
      
      // Log error for audit
      await this.logValidationResult(errorResult);
      
      return errorResult;
    }
  }

  /**
   * Check if query is performance-related
   */
  isPerformanceQuery(query) {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    const performanceKeywords = [
      'sales', 'revenue', 'performance', 'metrics', 'scorecard',
      'tpp', 'pat', 'fluid attach', 'oil change', 'tire', 'alignment', 'brake',
      'gross profit', 'gp', 'invoices', 'tickets', 'attach rate',
      'numbers', 'stats', 'statistics', 'kpi'
    ];

    return performanceKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Extract entity information (advisor/store/market ID) from query and context
   */
  extractEntityInfo(query, userId, contextData) {
    // Default to advisor level for the requesting user
    let entityInfo = {
      level: 'advisor',
      id: userId
    };

    if (contextData?.performance?.is_specific_person_query && contextData?.user?.id) {
      entityInfo.id = contextData.user.id;
    }

    // Check for store-level queries
    if (query && query.toLowerCase().includes('store')) {
      const storeMatch = query.match(/store\s+(\d+)/i);
      if (storeMatch && contextData?.user?.store_id) {
        entityInfo = {
          level: 'store',
          id: contextData.user.store_id
        };
      }
    }

    // Check for market-level queries
    if (query && query.toLowerCase().includes('market')) {
      const marketMatch = query.match(/market\s+(\d+)/i);
      if (marketMatch && contextData?.user?.market_id) {
        entityInfo = {
          level: 'market',
          id: contextData.user.market_id
        };
      }
    }

    return entityInfo;
  }

  /**
   * Fetch expected values from scorecard API endpoints
   */
  async fetchExpectedValues(entityInfo) {
    try {
      console.log(`📊 Fetching expected values from /api/scorecard/${entityInfo.level}/${entityInfo.id}`);
      
      const scorecardResult = await getValidatedScorecardData({
        level: entityInfo.level,
        id: entityInfo.id
      });

      if (scorecardResult.success && scorecardResult.data) {
        console.log('✅ Expected values fetched successfully');
        return this.normalizeExpectedData(scorecardResult.data, entityInfo.level);
      } else {
        console.warn('⚠️ Failed to fetch expected values from scorecard API');
        return {};
      }
      
    } catch (error) {
      console.error('❌ Error fetching expected values:', error);
      return {};
    }
  }

  /**
   * Normalize expected data based on entity level
   */
  normalizeExpectedData(data, level) {
    const normalized = {};
    
    if (level === 'advisor') {
      // Map advisor scorecard fields to standard metric names
      normalized.sales = this.parseNumericValue(data.sales);
      normalized.gpSales = this.parseNumericValue(data.gpSales);
      normalized.gpPercent = this.parseNumericValue(data.gpPercent);
      normalized.invoices = this.parseNumericValue(data.invoices);
      normalized.alignments = this.parseNumericValue(data.alignments);
      normalized.oilChange = this.parseNumericValue(data.oilChange);
      normalized.retailTires = this.parseNumericValue(data.retailTires);
      normalized.brakeService = this.parseNumericValue(data.brakeService);
      normalized.tpp = this.parseNumericValue(data.tpp);
      normalized.pat = this.parseNumericValue(data.pat);
    } else if (level === 'store') {
      // Map store scorecard fields
      normalized.sales = this.parseNumericValue(data.totalSales);
      normalized.gpSales = this.parseNumericValue(data.totalGpSales);
      normalized.invoices = this.parseNumericValue(data.totalInvoices);
    } else if (level === 'market') {
      // Map market scorecard fields
      normalized.sales = this.parseNumericValue(data.totalSales);
      normalized.gpSales = this.parseNumericValue(data.totalGpSales);
      normalized.invoices = this.parseNumericValue(data.totalInvoices);
    }
    
    return normalized;
  }

  /**
   * Extract numeric metrics from AI response text
   */
  extractMetricsFromResponse(responseText) {
    const detectedMetrics = {};
    
    for (const [metricName, pattern] of Object.entries(this.metricPatterns)) {
      const matches = responseText.match(pattern);
      if (matches && matches.length > 0) {
        // Extract the first numeric value found
        const numericValue = this.extractNumericFromMatch(matches[0]);
        if (numericValue !== null) {
          detectedMetrics[metricName] = numericValue;
        }
      }
    }
    
    return detectedMetrics;
  }

  /**
   * Extract numeric value from a matched string
   */
  extractNumericFromMatch(matchStr) {
    // Remove currency symbols, commas, and extract number
    const cleanStr = matchStr.replace(/[$,]/g, '');
    const numMatch = cleanStr.match(/[\d.]+/);
    
    if (numMatch) {
      const value = parseFloat(numMatch[0]);
      return isNaN(value) ? null : value;
    }
    
    return null;
  }

  /**
   * Parse numeric value handling various formats
   */
  parseNumericValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[$,%]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Compare expected vs detected metrics and identify mismatches
   */
  compareMetrics(expectedData, detectedMetrics) {
    const mismatches = [];
    
    for (const [metricName, detectedValue] of Object.entries(detectedMetrics)) {
      const expectedValue = expectedData[metricName];
      
      if (expectedValue !== null && expectedValue !== undefined) {
        const metricConfig = this.numericMetrics[metricName];
        
        if (metricConfig && !this.valuesMatch(expectedValue, detectedValue, metricConfig.tolerance)) {
          mismatches.push({
            metric: metricName,
            expected: expectedValue,
            detected: detectedValue,
            tolerance: metricConfig.tolerance,
            type: metricConfig.type,
            severity: this.calculateMismatchSeverity(expectedValue, detectedValue, metricConfig),
            message: `${metricName}: Expected ${expectedValue}, but AI response contained ${detectedValue}`
          });
        }
      }
    }
    
    return mismatches;
  }

  /**
   * Check if two values match within tolerance
   */
  valuesMatch(expected, detected, tolerance) {
    if (tolerance === 0) {
      return expected === detected;
    }
    
    const diff = Math.abs(expected - detected);
    return diff <= tolerance;
  }

  /**
   * Calculate severity of mismatch based on magnitude
   */
  calculateMismatchSeverity(expected, detected, metricConfig) {
    if (metricConfig.tolerance === 0) {
      return expected === detected ? 'low' : 'high';
    }
    
    const percentDiff = Math.abs((expected - detected) / expected) * 100;
    
    if (percentDiff < 5) return 'low';
    if (percentDiff < 15) return 'medium';
    return 'high';
  }

  /**
   * Calculate confidence score based on mismatches
   */
  calculateConfidenceScore(mismatches) {
    if (mismatches.length === 0) return 1.0;
    
    const severityWeights = { low: 0.05, medium: 0.15, high: 0.3 };
    const totalPenalty = mismatches.reduce((sum, mismatch) => {
      return sum + (severityWeights[mismatch.severity] || 0.2);
    }, 0);
    
    return Math.max(0, 1.0 - totalPenalty);
  }

  /**
   * Generate disclaimer text for responses with mismatches
   */
  generateDisclaimer(mismatches) {
    const highSeverityCount = mismatches.filter(m => m.severity === 'high').length;
    
    if (highSeverityCount > 0) {
      return `⚠️ ACCURACY WARNING: This response contains ${highSeverityCount} significant data discrepancies. Please verify all metrics independently using the official scorecard system.`;
    }
    
    return `⚠️ NOTICE: Some metrics in this response may not be fully accurate. Please cross-reference with the official scorecard for precise values.`;
  }

  /**
   * Rephrase AI response with corrections and disclaimers
   */
  async rephraseResponse(originalResponse, validationResult) {
    if (validationResult.isValid) {
      return originalResponse;
    }

    let rephrasedResponse = originalResponse;
    
    // Add disclaimer at the beginning
    if (validationResult.disclaimer) {
      rephrasedResponse = `${validationResult.disclaimer}\n\n${rephrasedResponse}`;
    }
    
    // Replace incorrect values with corrected ones (for high severity errors)
    const highSeverityMismatches = validationResult.mismatches.filter(m => m.severity === 'high');
    
    for (const mismatch of highSeverityMismatches) {
      const incorrectPattern = new RegExp(`\\b${mismatch.detected}\\b`, 'g');
      const correction = `${mismatch.expected} (corrected from ${mismatch.detected})`;
      rephrasedResponse = rephrasedResponse.replace(incorrectPattern, correction);
    }
    
    // Add audit information at the end
    rephrasedResponse += `\n\n📊 Data verified against official scorecard API (${validationResult.auditLog.timestamp})`;
    
    return rephrasedResponse;
  }

  /**
   * Log validation results for audit trail
   */
  async logValidationResult(validationResult) {
    if (!this.pool) {
      console.warn('⚠️ No database pool available for audit logging');
      return;
    }

    try {
      await this.pool.query(`
        INSERT INTO ai_validation_audit_log (
          user_id,
          query,
          validation_type,
          is_valid,
          mismatch_count,
          confidence_score,
          expected_values,
          detected_values,
          mismatches,
          disclaimer,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        validationResult.auditLog.userId,
        validationResult.auditLog.query,
        validationResult.auditLog.validationType,
        validationResult.isValid,
        validationResult.mismatches.length,
        validationResult.confidenceScore,
        JSON.stringify(validationResult.expectedValues),
        JSON.stringify(validationResult.detectedValues),
        JSON.stringify(validationResult.mismatches),
        validationResult.disclaimer
      ]);
      
      console.log(`📝 Validation audit logged: ${validationResult.isValid ? 'PASSED' : 'FAILED'}`);
      
    } catch (error) {
      console.error('❌ Failed to log validation audit:', error);
    }
  }

  /**
   * Get validation statistics for admin dashboard
   */
  async getValidationStats(days = 7) {
    if (!this.pool) return {};

    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_validations,
          COUNT(*) FILTER (WHERE is_valid = true) as passed_validations,
          COUNT(*) FILTER (WHERE is_valid = false) as failed_validations,
          AVG(confidence_score) as avg_confidence_score,
          AVG(mismatch_count) as avg_mismatch_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM ai_validation_audit_log
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `);

      return result.rows[0] || {};
    } catch (error) {
      console.error('❌ Error getting validation stats:', error);
      return {};
    }
  }
}

module.exports = AIValidationMiddleware;