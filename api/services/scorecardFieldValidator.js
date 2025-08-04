/**
 * Scorecard Field Validator
 * Ensures AI responses only use approved fields from official scorecard API endpoints
 * Prevents use of raw spreadsheet data or inferred metrics
 */

class ScorecardFieldValidator {
  constructor(pool = null) {
    this.pool = pool;
    this.initializeWhitelist();
  }

  /**
   * Official scorecard API field whitelist
   * These are the ONLY fields that can be referenced in AI responses for performance data
   */
  initializeWhitelist() {
    this.approvedFields = {
      // Core performance metrics from scorecard API
      sales: { type: 'currency', description: 'Total sales amount' },
      gpSales: { type: 'currency', description: 'Gross profit sales amount' },
      gpPercent: { type: 'percentage', description: 'Gross profit percentage' },
      invoices: { type: 'integer', description: 'Number of invoices' },
      
      // Service metrics
      alignments: { type: 'integer', description: 'Number of alignments performed' },
      oilChange: { type: 'integer', description: 'Number of oil changes performed' },
      retailTires: { type: 'integer', description: 'Number of retail tires sold' },
      brakeService: { type: 'integer', description: 'Number of brake services performed' },
      
      // Advanced calculated metrics (from scorecard system)
      tpp: { type: 'decimal', description: 'Tickets per Pit (calculated by scorecard system)' },
      pat: { type: 'decimal', description: 'Parts Attach Rate (calculated by scorecard system)' },
      
      // Fluid attach rates (complex object from scorecard system)
      fluid_attach_rates: { type: 'object', description: 'Fluid attachment rates by type' },
      fluidAttachRates: { type: 'object', description: 'Fluid attachment rates by type (alt format)' },
      
      // Metadata fields (allowed for context)
      period: { type: 'string', description: 'Reporting period' },
      store_name: { type: 'string', description: 'Store name' },
      storeName: { type: 'string', description: 'Store name (alt format)' },
      market_name: { type: 'string', description: 'Market name' },
      marketName: { type: 'string', description: 'Market name (alt format)' },
      advisor_name: { type: 'string', description: 'Advisor name' },
      advisorName: { type: 'string', description: 'Advisor name (alt format)' },
      
      // Timestamp fields
      retrieved_at: { type: 'datetime', description: 'When data was retrieved' },
      updated_at: { type: 'datetime', description: 'When data was last updated' },
      upload_date: { type: 'datetime', description: 'When data was uploaded (deprecated but allowed for context)' }
    };

    // Fields that are EXPLICITLY FORBIDDEN (common spreadsheet fields)
    this.forbiddenFields = [
      // Raw spreadsheet fields that should never be used
      'avgSpend', 'average_spend', 'ticketAverage', 'ticket_average',
      'mtdSales', 'mtd_sales', 'monthToDate', 'month_to_date',
      'rawData', 'raw_data', 'spreadsheetData', 'spreadsheet_data',
      'uploadedData', 'uploaded_data', 'performanceData', 'performance_data',
      
      // Fields that suggest inference or calculation
      'calculatedTPP', 'calculated_tpp', 'inferredPAT', 'inferred_pat',
      'estimatedAttachRate', 'estimated_attach_rate',
      'approximateFluidAttach', 'approximate_fluid_attach',
      
      // Vendor mapping fields (these come from separate validated endpoints)
      'vendorMapping', 'vendor_mapping', 'productMapping', 'product_mapping'
    ];

    console.log(`✅ Scorecard field validator initialized with ${Object.keys(this.approvedFields).length} approved fields`);
  }

  /**
   * Validate AI response for approved scorecard fields only
   */
  async validateResponse(response, userId, query, contextData = null) {
    try {
      const validation = {
        isValid: true,
        violations: [],
        approvedFields: [],
        timestamp: new Date().toISOString(),
        userId: userId,
        query: query
      };

      // Extract potential field references from response
      const fieldReferences = this.extractFieldReferences(response);
      
      // Check each reference against whitelist
      for (const fieldRef of fieldReferences) {
        if (this.isApprovedField(fieldRef)) {
          validation.approvedFields.push(fieldRef);
        } else if (this.isForbiddenField(fieldRef)) {
          validation.isValid = false;
          validation.violations.push({
            field: fieldRef,
            type: 'forbidden_field',
            severity: 'high',
            description: `Use of forbidden field '${fieldRef}' detected. This field suggests raw spreadsheet data usage.`
          });
        } else if (this.suggestsPerformanceData(fieldRef)) {
          validation.isValid = false;
          validation.violations.push({
            field: fieldRef,
            type: 'unapproved_performance_field',
            severity: 'medium',
            description: `Use of unapproved performance field '${fieldRef}'. Only scorecard API fields are allowed.`
          });
        }
      }

      // Additional context-based validation
      if (contextData?.performance?.data_source !== 'validated_scorecard_api' && 
          this.containsPerformanceMetrics(response)) {
        validation.isValid = false;
        validation.violations.push({
          field: 'data_source',
          type: 'invalid_data_source',
          severity: 'critical',
          description: 'Performance metrics referenced but data source is not validated_scorecard_api'
        });
      }

      // Log validation results
      await this.logValidation(validation);

      return validation;

    } catch (error) {
      console.error('❌ Error validating AI response:', error);
      return {
        isValid: false,
        violations: [{
          field: 'validator_error',
          type: 'system_error',
          severity: 'high',
          description: `Validation failed: ${error.message}`
        }],
        timestamp: new Date().toISOString(),
        userId: userId,
        query: query
      };
    }
  }

  /**
   * Extract potential field references from AI response text
   */
  extractFieldReferences(response) {
    const fieldReferences = new Set();
    
    // Pattern 1: Direct field mentions (case insensitive)
    const directFieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:[A-Z][a-zA-Z0-9_]*)*)\b/g;
    let match;
    while ((match = directFieldPattern.exec(response)) !== null) {
      const field = match[1].toLowerCase();
      if (field.length > 2) { // Ignore very short matches
        fieldReferences.add(field);
        // Also check camelCase variations
        fieldReferences.add(match[1]); // Original case
      }
    }

    // Pattern 2: JSON-like field references
    const jsonFieldPattern = /["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*:/g;
    while ((match = jsonFieldPattern.exec(response)) !== null) {
      fieldReferences.add(match[1]);
    }

    // Pattern 3: Variable-like references
    const variablePattern = /\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?/g;
    while ((match = variablePattern.exec(response)) !== null) {
      fieldReferences.add(match[1]);
    }

    return Array.from(fieldReferences);
  }

  /**
   * Check if field is in approved whitelist
   */
  isApprovedField(field) {
    return this.approvedFields.hasOwnProperty(field.toLowerCase()) ||
           this.approvedFields.hasOwnProperty(field);
  }

  /**
   * Check if field is explicitly forbidden
   */
  isForbiddenField(field) {
    return this.forbiddenFields.some(forbidden => 
      field.toLowerCase().includes(forbidden.toLowerCase()) ||
      forbidden.toLowerCase().includes(field.toLowerCase())
    );
  }

  /**
   * Check if field suggests performance data usage
   */
  suggestsPerformanceData(field) {
    const performanceKeywords = [
      'sales', 'revenue', 'profit', 'gp', 'invoice', 'ticket',
      'tire', 'oil', 'brake', 'alignment', 'service', 'attach',
      'tpp', 'pat', 'fluid', 'performance', 'metric'
    ];

    return performanceKeywords.some(keyword => 
      field.toLowerCase().includes(keyword) && 
      !this.isApprovedField(field)
    );
  }

  /**
   * Check if response contains performance metrics
   */
  containsPerformanceMetrics(response) {
    const performanceIndicators = [
      /\$[\d,]+(?:\.\d{2})?.*sales/i,
      /tpp.*\d+/i,
      /pat.*\d+/i,
      /fluid.*attach.*rate/i,
      /\d+.*alignments/i,
      /\d+.*oil.*changes/i,
      /\d+.*retail.*tires/i
    ];

    return performanceIndicators.some(pattern => pattern.test(response));
  }

  /**
   * Log validation results to database and console
   */
  async logValidation(validation) {
    try {
      // Console logging
      if (validation.isValid) {
        console.log(`✅ Scorecard validation passed for user ${validation.userId}`);
        if (validation.approvedFields.length > 0) {
          console.log(`   Approved fields used: ${validation.approvedFields.join(', ')}`);
        }
      } else {
        console.warn(`⚠️ Scorecard validation FAILED for user ${validation.userId}`);
        validation.violations.forEach(violation => {
          console.warn(`   ${violation.severity.toUpperCase()}: ${violation.description}`);
        });
      }

      // Database logging (if pool available)
      if (this.pool && validation.violations.length > 0) {
        await this.pool.query(`
          INSERT INTO ai_scorecard_violations (
            user_id, query, violations, response_excerpt, created_at
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          validation.userId,
          validation.query,
          JSON.stringify(validation.violations),
          validation.responseExcerpt || null,
          validation.timestamp
        ]);
      }

    } catch (error) {
      console.error('❌ Error logging validation results:', error.message);
    }
  }

  /**
   * Get sanitized response with violations removed/flagged
   */
  sanitizeResponse(response, validation) {
    if (validation.isValid) {
      return response;
    }

    let sanitizedResponse = response;

    // For high severity violations, add warning messages
    const highSeverityViolations = validation.violations.filter(v => v.severity === 'critical' || v.severity === 'high');
    
    if (highSeverityViolations.length > 0) {
      const warningMessage = `

⚠️ **Data Validation Warning**: This response may contain unvalidated performance data. All performance metrics should come from the official scorecard system.`;
      
      sanitizedResponse = sanitizedResponse + warningMessage;
    }

    return sanitizedResponse;
  }

  /**
   * Check if query should trigger scorecard validation
   */
  shouldValidate(query, contextData) {
    // Always validate if performance intent is detected
    if (contextData?.performance?.is_performance_query) {
      return true;
    }

    // Validate if query contains performance keywords
    const performanceKeywords = [
      'sales', 'revenue', 'performance', 'metrics', 'scorecard',
      'tpp', 'pat', 'fluid attach', 'tire', 'alignment', 'oil change'
    ];

    return performanceKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(days = 7) {
    if (!this.pool) {
      return { error: 'Database not available' };
    }

    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_validations,
          COUNT(CASE WHEN violations != '[]' THEN 1 END) as violations_count,
          COUNT(DISTINCT user_id) as unique_users,
          json_agg(DISTINCT violations) as violation_types
        FROM ai_scorecard_violations
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `);

      return result.rows[0] || {};
    } catch (error) {
      console.error('❌ Error getting validation stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = ScorecardFieldValidator;