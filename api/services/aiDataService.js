const { Pool } = require('pg');

/**
 * AI Data Service - Centralized data access for AI insights
 * Integrates with all existing APIs and provides comprehensive business intelligence
 */
class AIDataService {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Get comprehensive user context including all business relationships
   */
  async getUserContext(userId) {
    try {
      const userResult = await this.pool.query(`
        SELECT DISTINCT
          u.id, u.first_name as "firstName", u.last_name as "lastName",
          u.email, u.role, u.status,
          s.name as store_name, s.id as store_id, s.city as store_city, s.state as store_state,
          m.name as market_name, m.id as market_id
        FROM users u
        LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
        LEFT JOIN stores s ON usa.store_id::integer = s.id
        LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
        LEFT JOIN markets m ON uma.market_id::integer = m.id
        WHERE u.id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userData = userResult.rows[0];
      userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User';
      
      return userData;
    } catch (error) {
      console.error('❌ Error getting user context:', error);
      throw error;
    }
  }

  /**
   * Get market-level data and performance aggregations
   */
  async getMarketData(marketId = null, userId = null) {
    try {
      let marketQuery;
      let params = [];

      if (marketId) {
        // Specific market
        marketQuery = `
          SELECT 
            m.*,
            COALESCE(store_counts.store_count, 0) as store_count,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', vt.id,
                  'name', vt.name,
                  'color', vt.color
                )
              ) FILTER (WHERE vt.id IS NOT NULL), 
              '[]'
            ) as vendor_tag_details
          FROM markets m
          LEFT JOIN (
            SELECT market_id, COUNT(*) as store_count
            FROM stores
            GROUP BY market_id
          ) store_counts ON m.id = store_counts.market_id
          LEFT JOIN market_tags mt ON m.id = mt.market_id
          LEFT JOIN vendor_tags vt ON mt.tag_id = vt.id
          WHERE m.id = $1
          GROUP BY m.id, store_counts.store_count
        `;
        params = [marketId];
      } else if (userId) {
        // Markets accessible to user
        marketQuery = `
          SELECT DISTINCT
            m.*,
            COALESCE(store_counts.store_count, 0) as store_count,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', vt.id,
                  'name', vt.name,
                  'color', vt.color
                )
              ) FILTER (WHERE vt.id IS NOT NULL), 
              '[]'
            ) as vendor_tag_details
          FROM markets m
          LEFT JOIN user_market_assignments uma ON m.id = uma.market_id::integer
          LEFT JOIN (
            SELECT market_id, COUNT(*) as store_count
            FROM stores
            GROUP BY market_id
          ) store_counts ON m.id = store_counts.market_id
          LEFT JOIN market_tags mt ON m.id = mt.market_id
          LEFT JOIN vendor_tags vt ON mt.tag_id = vt.id
          WHERE uma.user_id = $1
          GROUP BY m.id, store_counts.store_count
        `;
        params = [userId.toString()];
      } else {
        // All markets
        marketQuery = `
          SELECT 
            m.*,
            COALESCE(store_counts.store_count, 0) as store_count,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'id', vt.id,
                  'name', vt.name,
                  'color', vt.color
                )
              ) FILTER (WHERE vt.id IS NOT NULL), 
              '[]'
            ) as vendor_tag_details
          FROM markets m
          LEFT JOIN (
            SELECT market_id, COUNT(*) as store_count
            FROM stores
            GROUP BY market_id
          ) store_counts ON m.id = store_counts.market_id
          LEFT JOIN market_tags mt ON m.id = mt.market_id
          LEFT JOIN vendor_tags vt ON mt.tag_id = vt.id
          GROUP BY m.id, store_counts.store_count
        `;
      }

      const result = await this.pool.query(marketQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting market data:', error);
      throw error;
    }
  }

  /**
   * Get store-level data with performance metrics
   */
  async getStoreData(storeId = null, marketId = null, userId = null) {
    try {
      let storeQuery;
      let params = [];

      if (storeId) {
        // Specific store
        storeQuery = `
          SELECT 
            s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip as zip_code, s.phone, s.created_at,
            m.name as market_name,
            COALESCE(
              STRING_AGG(
                CASE WHEN u.role = 'store_manager' 
                THEN u.first_name || ' ' || u.last_name 
                END, ', '
              ), 
              'Not assigned'
            ) as manager_name,
            COUNT(DISTINCT usa2.user_id) as advisor_count
          FROM stores s
          LEFT JOIN markets m ON s.market_id = m.id
          LEFT JOIN user_store_assignments usa ON s.id = usa.store_id::integer
          LEFT JOIN users u ON usa.user_id = u.id::text
          LEFT JOIN user_store_assignments usa2 ON s.id = usa2.store_id::integer
          LEFT JOIN users u2 ON usa2.user_id = u2.id::text AND u2.role = 'advisor'
          WHERE s.id = $1
          GROUP BY s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip, s.phone, s.created_at, m.name
        `;
        params = [storeId];
      } else if (marketId) {
        // Stores in specific market
        storeQuery = `
          SELECT 
            s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip as zip_code, s.phone, s.created_at,
            m.name as market_name,
            COALESCE(
              STRING_AGG(
                CASE WHEN u.role = 'store_manager' 
                THEN u.first_name || ' ' || u.last_name 
                END, ', '
              ), 
              'Not assigned'
            ) as manager_name,
            COUNT(DISTINCT usa2.user_id) as advisor_count
          FROM stores s
          LEFT JOIN markets m ON s.market_id = m.id
          LEFT JOIN user_store_assignments usa ON s.id = usa.store_id::integer
          LEFT JOIN users u ON usa.user_id = u.id::text
          LEFT JOIN user_store_assignments usa2 ON s.id = usa2.store_id::integer
          LEFT JOIN users u2 ON usa2.user_id = u2.id::text AND u2.role = 'advisor'
          WHERE s.market_id = $1
          GROUP BY s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip, s.phone, s.created_at, m.name
        `;
        params = [marketId];
      } else if (userId) {
        // Stores accessible to user
        storeQuery = `
          SELECT DISTINCT
            s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip as zip_code, s.phone, s.created_at,
            m.name as market_name,
            COALESCE(
              STRING_AGG(
                CASE WHEN u.role = 'store_manager' 
                THEN u.first_name || ' ' || u.last_name 
                END, ', '
              ), 
              'Not assigned'
            ) as manager_name,
            COUNT(DISTINCT usa2.user_id) as advisor_count
          FROM stores s
          LEFT JOIN markets m ON s.market_id = m.id
          LEFT JOIN user_store_assignments usa ON s.id = usa.store_id::integer
          LEFT JOIN users u ON usa.user_id = u.id::text
          LEFT JOIN user_store_assignments usa2 ON s.id = usa2.store_id::integer
          LEFT JOIN users u2 ON usa2.user_id = u2.id::text AND u2.role = 'advisor'
          WHERE usa.user_id = $1
          GROUP BY s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip, s.phone, s.created_at, m.name
        `;
        params = [userId.toString()];
      }

      const result = await this.pool.query(storeQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting store data:', error);
      throw error;
    }
  }

  /**
   * Get vendor and product mapping data
   */
  async getVendorData(vendorId = null) {
    try {
      let vendorQuery;
      let params = [];

      if (vendorId) {
        // Specific vendor
        vendorQuery = `
          SELECT 
            vpm.id,
            vpm.vendor_id as "vendorId",
            vt.name as "vendorName",
            vt.color as "vendorColor",
            vpm.service_field as "serviceField",
            vpm.product_name as "productName",
            vpm.description,
            vpm.created_at as "createdAt",
            vpm.updated_at as "updatedAt"
          FROM vendor_product_mappings vpm
          JOIN vendor_tags vt ON vpm.vendor_id = vt.id
          WHERE vt.id = $1
          ORDER BY vpm.service_field
        `;
        params = [vendorId];
      } else {
        // All vendor mappings
        vendorQuery = `
          SELECT 
            vpm.id,
            vpm.vendor_id as "vendorId",
            vt.name as "vendorName",
            vt.color as "vendorColor",
            vpm.service_field as "serviceField",
            vpm.product_name as "productName",
            vpm.description,
            vpm.created_at as "createdAt",
            vpm.updated_at as "updatedAt"
          FROM vendor_product_mappings vpm
          JOIN vendor_tags vt ON vpm.vendor_id = vt.id
          ORDER BY vt.name, vpm.service_field
        `;
      }

      const result = await this.pool.query(vendorQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting vendor data:', error);
      throw error;
    }
  }

  /**
   * Get service catalog and categories
   */
  async getServiceCatalog(categoryId = null) {
    try {
      // First check if services table exists
      const tableCheck = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'services'
        ) as exists;
      `);

      if (!tableCheck.rows[0].exists) {
        console.log('⚠️ Services table not found, returning empty array');
        return [];
      }

      let serviceQuery;
      let params = [];

      if (categoryId) {
        // Services in specific category
        serviceQuery = `
          SELECT 
            s.id, s.name, s.description, s.category_id, s.field_name, s.calculated_field,
            s.is_active, s.created_at, s.updated_at,
            sc.name as category_name, sc.description as category_description
          FROM services s
          JOIN service_categories sc ON s.category_id = sc.id
          WHERE s.category_id = $1 AND s.is_active = true
          ORDER BY s.name
        `;
        params = [categoryId];
      } else {
        // All services with categories
        serviceQuery = `
          SELECT 
            s.id, s.name, s.description, s.category_id, s.field_name, s.calculated_field,
            s.is_active, s.created_at, s.updated_at,
            sc.name as category_name, sc.description as category_description
          FROM services s
          JOIN service_categories sc ON s.category_id = sc.id
          WHERE s.is_active = true
          ORDER BY sc.name, s.name
        `;
      }

      const result = await this.pool.query(serviceQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting service catalog:', error.message);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * FORBIDDEN: Direct access to raw performance data
   * This method is permanently disabled to enforce scorecard API policy
   */
  async getPerformanceData(userId, limit = 3) {
    const error = new Error('POLICY VIOLATION: Direct access to raw performance data is forbidden. Use getValidatedScorecardData() utility from /utils/scorecardDataAccess.js instead.');
    console.error('🚫 POLICY VIOLATION: getPerformanceData() called - this method is permanently disabled');
    console.error('   Reason: Raw spreadsheet access is forbidden');
    console.error('   Required: Use getValidatedScorecardData() from /utils/scorecardDataAccess.js');
    console.error(`   User ID: ${userId}, Limit: ${limit}`);
    throw error;
  }

  /**
   * REPLACED: Use getValidatedScorecardData utility instead
   * This method is deprecated in favor of the centralized utility
   */
  async getValidatedScorecardResponse(targetType, targetId, contextUserId = null) {
    console.warn('⚠️ DEPRECATED: getValidatedScorecardResponse() is deprecated. Use getValidatedScorecardData() utility instead.');
    
    const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
    
    try {
      // Map old parameter names to new utility
      const level = targetType === 'user' ? 'advisor' : targetType;
      const result = await getValidatedScorecardData({ level, id: targetId });
      
      // Return in old format for backward compatibility
      return {
        success: result.success,
        data: result.data,
        source: result.metadata.source,
        endpoint: result.metadata.endpoint,
        target_type: targetType,
        target_id: targetId,
        retrieved_at: result.metadata.retrievedAt
      };
    } catch (error) {
      console.error(`❌ Error in deprecated getValidatedScorecardResponse: ${error.message}`);
      return {
        success: false,
        error: error.message,
        source: 'validated_scorecard_api',
        target_type: targetType,
        target_id: targetId,
        retrieved_at: new Date().toISOString()
      };
    }
  }

  /**
   * Detect if a query is asking for performance-related information
   */
  detectPerformanceIntent(query) {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Performance metrics keywords
    const performanceKeywords = [
      'sales', 'revenue', 'performance', 'metrics', 'scorecard', 'score card',
      'tpp', 'pat', 'fluid attach', 'oil change', 'tire', 'alignment', 'brake',
      'gross profit', 'gp', 'invoices', 'tickets', 'attach rate',
      'numbers', 'stats', 'statistics', 'kpi', 'goals', 'targets',
      'month', 'monthly', 'mtd', 'quarter', 'quarterly', 'year', 'yearly',
      'how much', 'how many', 'total', 'average', 'percent', 'percentage',
      'top performer', 'best', 'highest', 'leading', 'ranking'
    ];

    // Check for performance-related keywords
    const hasPerformanceKeywords = performanceKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );

    // Check for question patterns about performance
    const performancePatterns = [
      /what\s+(?:is|are|were)\s+.+(?:sales|performance|numbers|metrics)/i,
      /how\s+(?:much|many|well)\s+.+(?:sell|sold|perform|do|did)/i,
      /show\s+me\s+.+(?:performance|scorecard|metrics|numbers)/i,
      /.+(?:'s|s')\s+(?:sales|performance|numbers|metrics|scorecard)/i,
      /(?:total|monthly|yearly)\s+.+(?:sales|revenue|performance)/i
    ];

    const hasPerformancePattern = performancePatterns.some(pattern => 
      pattern.test(lowerQuery)
    );

    const isPerformanceQuery = hasPerformanceKeywords || hasPerformancePattern;
    
    if (isPerformanceQuery) {
      console.log(`🎯 Detected performance intent in query: "${query}"`);
    }
    
    return isPerformanceQuery;
  }

  /**
   * Get coaching history and threads
   */
  async getCoachingHistory(userId, limit = 10) {
    try {
      // Check if coaching tables exist
      const tableCheck = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'coaching_threads'
        ) as exists;
      `);

      if (!tableCheck.rows[0].exists) {
        console.log('⚠️ Coaching tables not found, returning empty array');
        return [];
      }

      const result = await this.pool.query(`
        SELECT 
          ct.id as thread_id,
          ct.subject,
          ct.created_at as thread_created,
          ct.last_activity,
          cm.id as message_id,
          cm.message,
          cm.created_at as message_created,
          cm.is_from_manager,
          sender.first_name || ' ' || sender.last_name as sender_name,
          sender.role as sender_role
        FROM coaching_threads ct
        LEFT JOIN coaching_messages cm ON ct.id = cm.thread_id
        LEFT JOIN users sender ON cm.from_user_id = sender.id
        WHERE ct.advisor_user_id = $1
        ORDER BY ct.last_activity DESC, cm.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting coaching history:', error.message);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get goals with progress tracking
   */
  async getGoalsData(userId, goalType = 'advisor') {
    try {
      const result = await this.pool.query(`
        SELECT 
          g.id,
          g.metric_name,
          g.target_value,
          g.period_type,
          g.goal_type,
          g.effective_date,
          g.created_at,
          creator.first_name || ' ' || creator.last_name as created_by_name
        FROM goals g
        LEFT JOIN users creator ON g.created_by = creator.id
        WHERE g.goal_type = $1 AND g.advisor_user_id = $2
        ORDER BY g.effective_date DESC
      `, [goalType, userId]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting goals data:', error);
      throw error;
    }
  }

  /**
   * Get scorecard template information
   */
  async getScorecardTemplates(marketId = null) {
    try {
      // Check if scorecard_templates table exists
      const tableCheck = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'scorecard_templates'
        ) as exists;
      `);

      if (!tableCheck.rows[0].exists) {
        console.log('⚠️ Scorecard templates table not found, returning empty array');
        return [];
      }

      let templateQuery;
      let params = [];

      if (marketId) {
        templateQuery = `
          SELECT DISTINCT
            st.id, st.name, st.description, st.market_id, st.is_active,
            st.created_at, st.updated_at,
            m.name as market_name,
            json_agg(
              DISTINCT jsonb_build_object(
                'id', stf.id,
                'service_id', stf.service_id,
                'display_name', stf.display_name,
                'display_order', stf.display_order,
                'is_required', stf.is_required,
                'service_name', s.name,
                'category_name', sc.name
              )
            ) as template_fields
          FROM scorecard_templates st
          LEFT JOIN markets m ON st.market_id = m.id
          LEFT JOIN scorecard_template_fields stf ON st.id = stf.template_id
          LEFT JOIN services s ON stf.service_id = s.id
          LEFT JOIN service_categories sc ON s.category_id = sc.id
          WHERE st.market_id = $1 AND st.is_active = true
          GROUP BY st.id, st.name, st.description, st.market_id, st.is_active, st.created_at, st.updated_at, m.name
        `;
        params = [marketId];
      } else {
        templateQuery = `
          SELECT DISTINCT
            st.id, st.name, st.description, st.market_id, st.is_active,
            st.created_at, st.updated_at,
            m.name as market_name,
            json_agg(
              DISTINCT jsonb_build_object(
                'id', stf.id,
                'service_id', stf.service_id,
                'display_name', stf.display_name,
                'display_order', stf.display_order,
                'is_required', stf.is_required,
                'service_name', s.name,
                'category_name', sc.name
              )
            ) as template_fields
          FROM scorecard_templates st
          LEFT JOIN markets m ON st.market_id = m.id
          LEFT JOIN scorecard_template_fields stf ON st.id = stf.template_id
          LEFT JOIN services s ON stf.service_id = s.id
          LEFT JOIN service_categories sc ON s.category_id = sc.id
          WHERE st.is_active = true
          GROUP BY st.id, st.name, st.description, st.market_id, st.is_active, st.created_at, st.updated_at, m.name
        `;
      }

      const result = await this.pool.query(templateQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting scorecard templates:', error.message);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * POLICY VIOLATION - PERMANENTLY DISABLED
   * This method directly accessed performance_data table, violating scorecard API policy
   */
  async getPeerComparison(userId, marketId = null, storeId = null, limit = 10) {
    const error = new Error('POLICY VIOLATION: getPeerComparison() directly accesses performance_data table. This method is permanently disabled. Use scorecard API endpoints instead.');
    console.error('🚫 POLICY VIOLATION: getPeerComparison() called - this method is permanently disabled');
    console.error('   Reason: Direct performance_data table access violates scorecard API policy');
    console.error('   Required: Use /api/scorecard/* endpoints only');
    console.error(`   Parameters: userId=${userId}, marketId=${marketId}, storeId=${storeId}, limit=${limit}`);
    throw error;
  }

  /**
   * POLICY VIOLATION - PERMANENTLY DISABLED
   * This method directly accessed performance_data table, violating scorecard API policy
   */
  async getMarketPerformanceData(marketId = null, month = null, year = null) {
    const error = new Error('POLICY VIOLATION: getMarketPerformanceData() directly accesses performance_data table. Use /api/scorecard/market/:marketId instead.');
    console.error('🚫 POLICY VIOLATION: getMarketPerformanceData() called - this method is permanently disabled');
    console.error('   Reason: Direct performance_data table access violates scorecard API policy');
    console.error('   Required: Use /api/scorecard/market/:marketId endpoint only');
    console.error(`   Parameters: marketId=${marketId}, month=${month}, year=${year}`);
    throw error;
  }

  /**
   * Get users/employees who work at a specific store
   */
  async getStoreEmployees(storeId = null, storeName = null) {
    try {
      let employeeQuery;
      let params = [];

      if (storeId) {
        // Get employees by store ID
        employeeQuery = `
          SELECT DISTINCT
            u.id, u.first_name, u.last_name, u.email, u.role, u.status,
            s.name as store_name, s.id as store_id, s.city as store_city, s.state as store_state,
            m.name as market_name, m.id as market_id,
            usa.assigned_at as assigned_date
          FROM users u
          JOIN user_store_assignments usa ON u.id::text = usa.user_id
          JOIN stores s ON usa.store_id::integer = s.id
          LEFT JOIN markets m ON s.market_id = m.id
          WHERE s.id = $1 AND u.status = 'active'
          ORDER BY u.role, u.last_name, u.first_name
        `;
        params = [storeId];
      } else if (storeName) {
        // Get employees by store name (case insensitive)
        employeeQuery = `
          SELECT DISTINCT
            u.id, u.first_name, u.last_name, u.email, u.role, u.status,
            s.name as store_name, s.id as store_id, s.city as store_city, s.state as store_state,
            m.name as market_name, m.id as market_id,
            usa.assigned_at as assigned_date
          FROM users u
          JOIN user_store_assignments usa ON u.id::text = usa.user_id
          JOIN stores s ON usa.store_id::integer = s.id
          LEFT JOIN markets m ON s.market_id = m.id
          WHERE LOWER(s.name) LIKE LOWER($1) AND u.status = 'active'
          ORDER BY u.role, u.last_name, u.first_name
        `;
        params = [`%${storeName}%`];
      } else {
        throw new Error('Either storeId or storeName must be provided');
      }

      const result = await this.pool.query(employeeQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting store employees:', error);
      throw error;
    }
  }

  /**
   * Get organizational structure - all users with their assignments
   */
  async getOrganizationalStructure(marketId = null) {
    try {
      let orgQuery;
      let params = [];

      if (marketId) {
        // Get org structure for specific market
        orgQuery = `
          SELECT DISTINCT
            u.id, u.first_name, u.last_name, u.email, u.role, u.status,
            s.name as store_name, s.id as store_id, s.city as store_city, s.state as store_state,
            m.name as market_name, m.id as market_id,
            usa.assigned_at as store_assigned_date,
            uma.assigned_at as market_assigned_date
          FROM users u
          LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
          LEFT JOIN stores s ON usa.store_id::integer = s.id
          LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
          LEFT JOIN markets m ON uma.market_id::integer = m.id
          WHERE (m.id = $1 OR u.role IN ('admin', 'administrator')) AND u.status = 'active'
          ORDER BY m.name, s.name, u.role, u.last_name, u.first_name
        `;
        params = [marketId];
      } else {
        // Get complete org structure
        orgQuery = `
          SELECT DISTINCT
            u.id, u.first_name, u.last_name, u.email, u.role, u.status,
            s.name as store_name, s.id as store_id, s.city as store_city, s.state as store_state,
            m.name as market_name, m.id as market_id,
            usa.assigned_at as store_assigned_date,
            uma.assigned_at as market_assigned_date
          FROM users u
          LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
          LEFT JOIN stores s ON usa.store_id::integer = s.id
          LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
          LEFT JOIN markets m ON uma.market_id::integer = m.id
          WHERE u.status = 'active'
          ORDER BY m.name, s.name, u.role, u.last_name, u.first_name
        `;
      }

      const result = await this.pool.query(orgQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting organizational structure:', error);
      throw error;
    }
  }

  /**
   * Search for users by name, role, or location
   */
  async searchUsers(searchTerm, searchType = 'name') {
    try {
      let searchQuery;
      let params = [];

      switch (searchType.toLowerCase()) {
        case 'role':
          searchQuery = `
            SELECT DISTINCT
              u.id, u.first_name, u.last_name, u.email, u.role, u.status,
              s.name as store_name, s.id as store_id,
              m.name as market_name, m.id as market_id
            FROM users u
            LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
            LEFT JOIN stores s ON usa.store_id::integer = s.id
            LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
            LEFT JOIN markets m ON uma.market_id::integer = m.id
            WHERE LOWER(u.role) LIKE LOWER($1) AND u.status = 'active'
            ORDER BY u.last_name, u.first_name
          `;
          params = [`%${searchTerm}%`];
          break;
        case 'location':
        case 'store':
          searchQuery = `
            SELECT DISTINCT
              u.id, u.first_name, u.last_name, u.email, u.role, u.status,
              s.name as store_name, s.id as store_id, s.city, s.state,
              m.name as market_name, m.id as market_id
            FROM users u
            JOIN user_store_assignments usa ON u.id::text = usa.user_id
            JOIN stores s ON usa.store_id::integer = s.id
            LEFT JOIN markets m ON s.market_id = m.id
            WHERE (LOWER(s.name) LIKE LOWER($1) OR LOWER(s.city) LIKE LOWER($1) OR LOWER(s.state) LIKE LOWER($1))
              AND u.status = 'active'
            ORDER BY s.name, u.role, u.last_name, u.first_name
          `;
          params = [`%${searchTerm}%`];
          break;
        default: // name search
          searchQuery = `
            SELECT DISTINCT
              u.id, u.first_name, u.last_name, u.email, u.role, u.status,
              s.name as store_name, s.id as store_id,
              m.name as market_name, m.id as market_id
            FROM users u
            LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
            LEFT JOIN stores s ON usa.store_id::integer = s.id
            LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
            LEFT JOIN markets m ON uma.market_id::integer = m.id
            WHERE (LOWER(u.first_name) LIKE LOWER($1) OR LOWER(u.last_name) LIKE LOWER($1) 
                   OR LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($1))
              AND u.status = 'active'
            ORDER BY u.last_name, u.first_name
          `;
          params = [`%${searchTerm}%`];
      }

      const result = await this.pool.query(searchQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error searching users:', error);
      throw error;
    }
  }

  /**
   * Get store history for a specific user by name
   */
  async getUserStoreHistory(userName) {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT
          u.id, u.first_name, u.last_name, u.role,
          s.name as store_name, s.city, s.state,
          m.name as market_name,
          usa.assigned_at,
          COALESCE(perf_stats.record_count, 0) as performance_records,
          perf_stats.first_record,
          perf_stats.last_record
        FROM users u
        JOIN user_store_assignments usa ON u.id::text = usa.user_id
        JOIN stores s ON usa.store_id::integer = s.id
        LEFT JOIN markets m ON s.market_id = m.id
        LEFT JOIN (
          SELECT 
            advisor_user_id,
            store_id,
            COUNT(*) as record_count,
            MIN(upload_date) as first_record,
            MAX(upload_date) as last_record
          FROM performance_data
          GROUP BY advisor_user_id, store_id
        ) perf_stats ON u.id = perf_stats.advisor_user_id AND s.id = perf_stats.store_id
        WHERE (LOWER(u.first_name) LIKE LOWER($1) OR LOWER(u.last_name) LIKE LOWER($1) 
               OR LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($1))
          AND u.status = 'active'
        ORDER BY usa.assigned_at DESC, perf_stats.last_record DESC
      `, [`%${userName}%`]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting user store history:', error);
      throw error;
    }
  }

  /**
   * POLICY VIOLATION - PERMANENTLY DISABLED
   * This method directly accessed performance_data table, violating scorecard API policy
   */
  async getUserStoreHistoryByTimeframe(userName, month, year) {
    const error = new Error('POLICY VIOLATION: getUserStoreHistoryByTimeframe() directly accesses performance_data table. Use organizational lookup functions instead.');
    console.error('🚫 POLICY VIOLATION: getUserStoreHistoryByTimeframe() called - this method is permanently disabled');
    console.error('   Reason: Direct performance_data table access violates scorecard API policy');
    console.error('   Required: Use getUserContext(), getStoreEmployees(), getOrganizationalStructure() for organizational data');
    console.error(`   Parameters: userName=${userName}, month=${month}, year=${year}`);
    throw error;
  }

  /**
   * Analyze query to detect organizational questions and extract relevant data
   */
  async analyzeOrganizationalQuery(query, userId) {
    const lowerQuery = query.toLowerCase();
    
    // Detect store employee queries
    if (lowerQuery.includes('who works') || lowerQuery.includes('who is at') || 
        lowerQuery.includes('employees at') || lowerQuery.includes('staff at')) {
      
      // Extract store name from query - improved pattern matching
      const storeMatches = lowerQuery.match(/(?:at|in)\s+([^?.,!]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/);
      if (storeMatches) {
        let storeName = storeMatches[1].trim();
        // Remove common suffixes like "store", "location", "shop"
        storeName = storeName.replace(/\s+(store|location|shop)$/, '');
        console.log(`🔍 Detected store employee query for: "${storeName}"`);
        return await this.getStoreEmployees(null, storeName);
      }
    }
    
    // Detect role + location queries BEFORE general role queries
    // Enhanced patterns for admin organizational queries with direct responses
    const roleLocationPatterns = [
      // Pattern 1: "what/which/who are the [role] at [location]"
      /(?:what|which|who)\s+(?:are\s+(?:the\s+)?)?(?:advisors?|managers?|employees?)\s+(?:are\s+)?(?:at|in)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/i,
      // Pattern 2: "what/which [role] are working at [location]"
      /(?:what|which)\s+(managers?|advisors?|employees?)\s+are\s+working\s+(?:at|in)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/i,
      // Pattern 3: "what/which [role] work at [location]" 
      /(?:what|which)\s+(managers?|advisors?|employees?)\s+work\s+(?:at|in)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/i,
      // Pattern 4: "list [role] at/for [location]"
      /(?:list|show)\s+(?:me\s+)?(?:the\s+)?(managers?|advisors?|employees?)\s+(?:at|for|in)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/i,
      // Pattern 5: "who are the advisors at [location]" (direct match)
      /who\s+are\s+(?:the\s+)?(managers?|advisors?|employees?)\s+(?:at|in)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/i
    ];
    
    for (const pattern of roleLocationPatterns) {
      const roleLocationMatch = lowerQuery.match(pattern);
      if (roleLocationMatch) {
        // Extract role and store name from different capture groups depending on pattern
        let role, storeName;
        
        // Determine if first capture group contains a role or store name
        const possibleRole = roleLocationMatch[1]?.toLowerCase();
        const isRoleInFirstGroup = possibleRole && ['advisor', 'advisors', 'manager', 'managers', 'employee', 'employees'].some(r => possibleRole.includes(r));
        
        if (isRoleInFirstGroup) {
          // Standard pattern: role in first capture, store in second
          role = roleLocationMatch[1];
          storeName = roleLocationMatch[2]?.trim();
        } else {
          // Pattern 1 case: store name is in first capture group, detect role from query
          storeName = roleLocationMatch[1]?.trim();
          if (query.toLowerCase().includes('advisor')) role = 'advisors';
          else if (query.toLowerCase().includes('manager')) role = 'managers';
          else role = 'employees';
        }
        
        // Ensure both role and storeName are defined
        if (!role || !storeName) {
          console.log(`⚠️ Could not extract role (${role}) or store name (${storeName}) from pattern match`);
          continue;
        }
        
        console.log(`🔍 Detected role+location query: ${role} at "${storeName}"`);
        
        // Use optimized function for advisor queries
        if (role.toLowerCase().includes('advisor')) {
          console.log(`🎯 Using optimized getAdvisorsByStoreName for advisor query`);
          const result = await this.getAdvisorsByStoreName(storeName);
          if (result.success) {
            return result.advisors;
          } else {
            // Return empty array with error info that AI can use
            return [];
          }
        } else {
          return await this.getStoreEmployeesByRole(storeName, role);
        }
      }
    }
    
    // Detect role-based queries (only if not a location-specific query)
    if (lowerQuery.includes('managers') || lowerQuery.includes('advisors') || 
        lowerQuery.includes('admin')) {
      const roleMatch = lowerQuery.match(/(managers?|advisors?|admins?|administrators?)/);
      if (roleMatch) {
        const role = roleMatch[1];
        console.log(`🔍 Detected role-based query for: "${role}"`);
        return await this.searchUsers(role, 'role');
      }
    }
    
    // Detect "what stores has X worked at" queries (multiple patterns)
    let storeHistoryMatches = lowerQuery.match(/what stores.*(has|have)\s+([a-zA-Z\s]+?)(?:\s+from\s+[^work]*?)?\s+work/);
    if (!storeHistoryMatches) {
      // Try "where has X worked" pattern
      storeHistoryMatches = lowerQuery.match(/where.*(has|have)\s+([a-zA-Z\s]+)\s+work/);
    }
    if (!storeHistoryMatches) {
      // Try "what stores did X work at during [timeframe]" pattern
      storeHistoryMatches = lowerQuery.match(/what stores\s+(?:did|does)\s+([a-zA-Z\s]+?)\s+work\s+at(?:\s+during|\s+in)?/);
      if (storeHistoryMatches) {
        storeHistoryMatches = [null, null, storeHistoryMatches[1]]; // Adjust array structure
      }
    }
    if (!storeHistoryMatches) {
      // Try "show me X store history" pattern
      storeHistoryMatches = lowerQuery.match(/show me\s+([a-zA-Z\s]+)\s+store\s+history/);
      if (storeHistoryMatches) {
        storeHistoryMatches = [null, null, storeHistoryMatches[1]]; // Adjust array structure
      }
    }
    if (storeHistoryMatches) {
      let name = storeHistoryMatches[2].trim();
      // Clean up the name (remove "from tire south" type suffixes)
      name = name.replace(/\s+from\s+.*$/, '');
      
      // Extract timeframe from the original query
      let targetMonth = null;
      let targetYear = null;
      if (lowerQuery.includes('july')) targetMonth = 7;
      else if (lowerQuery.includes('august')) targetMonth = 8;
      else if (lowerQuery.includes('september')) targetMonth = 9;
      else if (lowerQuery.includes('june')) targetMonth = 6;
      
      const yearMatch = lowerQuery.match(/20\d{2}/);
      if (yearMatch) targetYear = parseInt(yearMatch[0]);
      
      if (targetMonth && targetYear) {
        console.log(`🔍 Detected store history query for: "${name}" during ${targetMonth}/${targetYear}`);
        console.log('🚫 POLICY ENFORCEMENT: getUserStoreHistoryByTimeframe() disabled - use organizational lookup functions instead');
        console.log(`   Query requested: store history for "${name}" during ${targetMonth}/${targetYear}`);
        console.log('   Required: Use getUserContext(), getStoreEmployees(), getOrganizationalStructure()');
        return [];
      } else {
        console.log(`🔍 Detected store history query for: "${name}"`);
        return await this.getUserStoreHistory(name);
      }
    }
    
    // Detect store manager queries BEFORE general name searches
    const storeManagerMatches = lowerQuery.match(/(?:who\s+(?:is\s+(?:the\s+)?)?|what\s+(?:is\s+(?:the\s+)?)?)\s*(?:store\s+)?manager\s+(?:of\s+|at\s+|for\s+)?([a-zA-Z\s]+)/i);
    if (storeManagerMatches) {
      const storeName = storeManagerMatches[1].trim();
      // Remove "store" suffix if present
      const cleanStoreName = storeName.replace(/\s+store$/i, '');
      console.log(`🔍 Detected store manager query for: "${cleanStoreName}"`);
      return await this.getStoreManager(cleanStoreName);
    }
    
    // Detect name searches
    const nameMatches = lowerQuery.match(/(?:who is|find|search for)\s+([a-zA-Z\s]+)/);
    if (nameMatches) {
      const name = nameMatches[1].trim();
      console.log(`🔍 Detected name search for: "${name}"`);
      return await this.searchUsers(name, 'name');
    }
    
    return null; // No organizational query detected
  }

  /**
   * Get advisors specifically by store name - optimized for common organizational queries
   */
  async getAdvisorsByStoreName(storeName) {
    try {
      console.log(`🔍 Searching for advisors at store: "${storeName}"`);
      
      // First check if the store exists
      const storeCheck = await this.pool.query(`
        SELECT id, name, city, state 
        FROM stores 
        WHERE name ILIKE $1
        LIMIT 1
      `, [`%${storeName}%`]);
      
      if (storeCheck.rows.length === 0) {
        console.log(`❌ No store found matching: "${storeName}"`);
        return {
          success: false,
          error: `No store found with the name '${storeName}'. Please double-check the spelling.`,
          advisors: []
        };
      }
      
      const store = storeCheck.rows[0];
      console.log(`✅ Found store: ${store.name} (ID: ${store.id})`);
      
      // Get advisors for the store
      const result = await this.pool.query(`
        SELECT DISTINCT
          u.id, u.first_name, u.last_name, u.email, u.role,
          s.name as store_name, s.city, s.state
        FROM users u
        JOIN user_store_assignments usa ON u.id::text = usa.user_id
        JOIN stores s ON usa.store_id = s.id
        WHERE s.name ILIKE $1 AND u.role = 'advisor' AND u.status = 'active'
        ORDER BY u.last_name, u.first_name
      `, [`%${storeName}%`]);

      console.log(`📊 Found ${result.rows.length} advisors at ${store.name}`);
      
      return {
        success: true,
        store: store,
        advisors: result.rows,
        count: result.rows.length
      };
    } catch (err) {
      console.error("❌ Error fetching advisors by store name:", err);
      return {
        success: false,
        error: `Database error while searching for advisors at '${storeName}'.`,
        advisors: []
      };
    }
  }

  /**
   * Get store manager for a specific store
   */
  async getStoreManager(storeName) {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT
          u.id,
          u.first_name,
          u.last_name,
          u.role,
          s.name as store_name,
          s.city,
          s.state,
          m.name as market_name
        FROM users u
        JOIN user_store_assignments usa ON u.id::text = usa.user_id
        JOIN stores s ON usa.store_id::integer = s.id
        LEFT JOIN markets m ON s.market_id = m.id
        WHERE LOWER(s.name) LIKE LOWER($1)
          AND u.role = 'store_manager'
          AND u.status = 'active'
        ORDER BY u.last_name, u.first_name
      `, [`%${storeName}%`]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting store manager:', error);
      throw error;
    }
  }

  /**
   * Get employees by role at a specific store
   */
  async getStoreEmployeesByRole(storeName, role) {
    try {
      // Normalize role names
      let roleFilter = role.toLowerCase();
      if (roleFilter === 'advisors') roleFilter = 'advisor';
      else if (roleFilter === 'managers') roleFilter = '%manager%';
      else if (roleFilter === 'employees') roleFilter = '%'; // All roles
      
      const result = await this.pool.query(`
        SELECT DISTINCT
          u.id,
          u.first_name,
          u.last_name,
          u.role,
          s.name as store_name,
          s.city,
          s.state,
          m.name as market_name
        FROM users u
        JOIN user_store_assignments usa ON u.id::text = usa.user_id
        JOIN stores s ON usa.store_id::integer = s.id
        LEFT JOIN markets m ON s.market_id = m.id
        WHERE LOWER(s.name) LIKE LOWER($1)
          AND LOWER(u.role) LIKE LOWER($2)
          AND u.status = 'active'
        ORDER BY u.role, u.last_name, u.first_name
      `, [`%${storeName}%`, roleFilter]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting store employees by role:', error);
      throw error;
    }
  }

  /**
   * POLICY VIOLATION - PERMANENTLY DISABLED
   * This method directly accessed performance_data table, violating scorecard API policy
   */
  async getMonthYearPerformance(marketName, month, year) {
    const error = new Error('POLICY VIOLATION: getMonthYearPerformance() directly accesses performance_data table. Use /api/scorecard/market/:marketId instead.');
    console.error('🚫 POLICY VIOLATION: getMonthYearPerformance() called - this method is permanently disabled');
    console.error('   Reason: Direct performance_data table access violates scorecard API policy');
    console.error('   Required: Use /api/scorecard/market/:marketId endpoint only');
    console.error(`   Parameters: marketName=${marketName}, month=${month}, year=${year}`);
    throw error;
  }

  /**
   * POLICY VIOLATION - PERMANENTLY DISABLED
   * This method directly accessed performance_data table, violating scorecard API policy
   */
  async getTopPerformers(metric, marketName, month, year, limit = 5) {
    const error = new Error('POLICY VIOLATION: getTopPerformers() directly accesses performance_data table. Use scorecard API endpoints instead.');
    console.error('🚫 POLICY VIOLATION: getTopPerformers() called - this method is permanently disabled');
    console.error('   Reason: Direct performance_data table access violates scorecard API policy');
    console.error('   Required: Use /api/scorecard/* endpoints for performance comparisons');
    console.error(`   Parameters: metric=${metric}, marketName=${marketName}, month=${month}, year=${year}, limit=${limit}`);
    throw error;
  }

  /**
   * Log AI interaction for behavior learning
   */
  async logInteraction(userId, query, queryType, response, contextData = null, modelUsed = 'llama3.1:8b', responseTimeMs = null, sessionId = null) {
    try {
      const result = await this.pool.query(`
        SELECT log_ai_interaction($1, $2, $3, $4, $5, $6, $7, $8) as interaction_id
      `, [userId, query, queryType, response, contextData ? JSON.stringify(contextData) : null, modelUsed, responseTimeMs, sessionId]);
      
      return result.rows[0].interaction_id;
    } catch (error) {
      console.warn('⚠️ Could not log AI interaction:', error.message);
      return null;
    }
  }

  /**
   * Get user preferences for personalized responses
   */
  async getUserPreferences(userId) {
    try {
      const result = await this.pool.query(`
        SELECT preference_type, preference_value, confidence_score
        FROM ai_user_preferences
        WHERE user_id = $1
      `, [userId]);
      
      const preferences = {};
      result.rows.forEach(row => {
        preferences[row.preference_type] = {
          value: row.preference_value,
          confidence: row.confidence_score
        };
      });
      
      return preferences;
    } catch (error) {
      console.warn('⚠️ Could not get user preferences:', error.message);
      return {};
    }
  }

  /**
   * Get user's common query patterns and knowledge domains
   */
  async getUserKnowledgePatterns(userId) {
    try {
      const result = await this.pool.query(`
        SELECT knowledge_domain, specific_topics, frequency_score, last_queried
        FROM ai_user_knowledge_patterns
        WHERE user_id = $1
        ORDER BY frequency_score DESC
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.warn('⚠️ Could not get user knowledge patterns:', error.message);
      return [];
    }
  }

  /**
   * Update user preference based on interaction
   */
  async updateUserPreference(userId, preferenceType, preferenceValue, confidenceScore = 0.7) {
    try {
      await this.pool.query(`
        INSERT INTO ai_user_preferences (user_id, preference_type, preference_value, confidence_score)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, preference_type)
        DO UPDATE SET
          preference_value = $3,
          confidence_score = LEAST(1.0, ai_user_preferences.confidence_score + 0.1),
          learned_from_interactions = ai_user_preferences.learned_from_interactions + 1,
          last_updated = CURRENT_TIMESTAMP
      `, [userId, preferenceType, JSON.stringify(preferenceValue), confidenceScore]);
    } catch (error) {
      console.warn('⚠️ Could not update user preference:', error.message);
    }
  }

  /**
   * Build comprehensive context for AI with all business data
   * IMPORTANT: Uses validated scorecard endpoints for all performance data
   */
  async buildComprehensiveContext(userId, query = null) {
    try {
      console.log('🔄 Building comprehensive AI context for user:', userId);

      // Get base user context
      const userData = await this.getUserContext(userId);
      
      // Get user behavior patterns and preferences for personalization
      let userPreferences = {};
      let userKnowledgePatterns = [];
      try {
        userPreferences = await this.getUserPreferences(userId);
        userKnowledgePatterns = await this.getUserKnowledgePatterns(userId);
      } catch (error) {
        console.warn('⚠️ Could not get user behavior data:', error.message);
      }
      
      // CRITICAL: Detect performance intent first
      const isPerformanceQuery = this.detectPerformanceIntent(query);
      
      // Initialize performance data containers
      let performanceData = null;
      let specificPersonQuery = null;
      let specificPersonPerformanceData = null;
      
      // ADMIN OVERRIDE: Enhanced scorecard access for admin users
      if (isPerformanceQuery) {
        console.log('🎯 Performance query detected - enforcing scorecard API policy');
        
        // Check if user is admin for enhanced data access
        const isAdmin = userData.role === 'admin' || userData.role === 'administrator';
        if (isAdmin) {
          console.log('🔓 ADMIN OVERRIDE: Enhanced scorecard access enabled');
        }
        
        const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
        
        // Check if asking about specific person's performance
        if (query) {
          const lowerQuery = query.toLowerCase();
          
          // Enhanced person-specific performance patterns for admin scorecard access
          let personPerfMatch = lowerQuery.match(/(?:what\s+(?:is|does|are)|how\s+(?:is|does|are))\s+([a-zA-Z\s]+?)(?:'s|\s+)(?:performance|doing|sales|numbers)/i);
          
          if (!personPerfMatch) {
            // Pattern: "Show me [Name] scorecard" 
            personPerfMatch = lowerQuery.match(/show\s+me\s+([a-zA-Z\s]+?)\s+scorecard/i);
          }
          
          if (!personPerfMatch) {
            // Pattern: "Get [Name] scorecard" 
            personPerfMatch = lowerQuery.match(/(?:get|give\s+me)\s+([a-zA-Z\s]+?)\s+scorecard/i);
          }
          
          if (!personPerfMatch) {
            // Pattern: "[Name]'s total sales" etc.
            personPerfMatch = lowerQuery.match(/([a-zA-Z\s]+?)(?:'s|s')\s+(?:total\s+)?(?:retail\s+|monthly\s+|overall\s+)?(?:sales|performance|numbers|alignments|tires?|revenue|metrics|data)/i);
          }
          
          if (!personPerfMatch) {
            // Pattern: "scorecard for [Name]" or "data for [Name]"
            personPerfMatch = lowerQuery.match(/(?:scorecard|data|metrics|performance)\s+for\s+([a-zA-Z\s]+)/i);
          }
          
          if (personPerfMatch) {
            let personName = personPerfMatch[1].trim();
            
            // Clean up name variations
            personName = personName.replace(/\b(akeem|akiem)\b/gi, 'akeen');
            personName = personName.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '');
            personName = personName.replace(/\b(20\d{2}|19\d{2})\b/g, '');
            personName = personName.replace(/\b(mtd|month|quarterly|yearly)\b/gi, '');
            personName = personName.trim().replace(/\s+/g, ' ');
            
            if (personName.endsWith('s') && !personName.endsWith('ss')) {
              personName = personName.replace(/s$/, '');
            }
            
            console.log(`🔍 Detected specific person performance query for: "${personName}"`);
            
            // Extract date parameters from query for MTD data
            let mtdMonth = null;
            let mtdYear = null;
            
            if (lowerQuery.includes('august')) mtdMonth = 8;
            else if (lowerQuery.includes('july')) mtdMonth = 7;
            else if (lowerQuery.includes('september')) mtdMonth = 9;
            else if (lowerQuery.includes('october')) mtdMonth = 10;
            else if (lowerQuery.includes('november')) mtdMonth = 11;
            else if (lowerQuery.includes('december')) mtdMonth = 12;
            else if (lowerQuery.includes('january')) mtdMonth = 1;
            else if (lowerQuery.includes('february')) mtdMonth = 2;
            else if (lowerQuery.includes('march')) mtdMonth = 3;
            else if (lowerQuery.includes('april')) mtdMonth = 4;
            else if (lowerQuery.includes('may')) mtdMonth = 5;
            else if (lowerQuery.includes('june')) mtdMonth = 6;
            
            const yearMatch = lowerQuery.match(/20\d{2}/);
            if (yearMatch) mtdYear = parseInt(yearMatch[0]);
            else mtdYear = new Date().getFullYear(); // Default to current year
            
            // Default to current month if no month specified to avoid historical fake data
            if (!mtdMonth) {
              mtdMonth = new Date().getMonth() + 1; // Current month (1-12)
              console.log(`📅 No month specified, defaulting to current month: ${mtdMonth}/${mtdYear}`);
            } else {
              console.log(`📅 Extracted date parameters: ${mtdMonth}/${mtdYear}`);
            }
            
            try {
              const personResults = await this.searchUsers(personName, 'name');
              if (personResults.length > 0) {
                const personId = personResults[0].id;
                console.log(`📊 POLICY ENFORCEMENT: Getting advisor scorecard for ${personResults[0].first_name} ${personResults[0].last_name} (ID: ${personId})`);
                
                specificPersonQuery = personName;
                // Use VALIDATED scorecard utility with date parameters for MTD data
                const scorecardParams = { 
                  level: 'advisor', 
                  id: personId
                  // Let utility determine correct baseURL (Docker internal vs external)
                };
                
                // Add MTD parameters (always present now with defaults)
                scorecardParams.mtdMonth = mtdMonth;
                scorecardParams.mtdYear = mtdYear;
                console.log(`📊 ADMIN ACCESS: Fetching MTD scorecard for ${mtdMonth}/${mtdYear}`);
                
                const scorecardResult = await getValidatedScorecardData(scorecardParams);
                
                specificPersonPerformanceData = {
                  success: scorecardResult.success,
                  data: scorecardResult.data,
                  metadata: scorecardResult.metadata
                };
              }
            } catch (error) {
              console.error('⚠️ POLICY ENFORCEMENT FAILED: Could not get specific person scorecard:', error.message);
              specificPersonPerformanceData = {
                success: false,
                error: error.message,
                metadata: { source: 'validated_scorecard_api', dataIntegrity: 'failed' }
              };
            }
          }
        }
        
        // Get performance data for the requesting user using VALIDATED scorecard utility
        if (!specificPersonPerformanceData) {
          console.log(`📊 POLICY ENFORCEMENT: Getting advisor scorecard for requesting user (ID: ${userId})`);
          
          try {
            const scorecardResult = await getValidatedScorecardData({ 
              level: 'advisor', 
              id: userId
              // Let utility determine correct baseURL (Docker internal vs external)
            });
            
            performanceData = {
              success: scorecardResult.success,
              data: scorecardResult.data,
              metadata: scorecardResult.metadata
            };
          } catch (error) {
            console.error('⚠️ POLICY ENFORCEMENT FAILED: Could not get user scorecard:', error.message);
            performanceData = {
              success: false,
              error: error.message,
              metadata: { source: 'validated_scorecard_api', dataIntegrity: 'failed' }
            };
          }
        }
      }

      // Enhanced top performers detection (do this BEFORE organizational query analysis)
      let topPerformersData = null;
      let isTopPerformerQuery = false;
      
      if (query) {
        const lowerQuery = query.toLowerCase();
        
        // Detect top performer queries with various patterns - PRIORITY CHECK
        if (lowerQuery.match(/top\s+(\w+\s+)?(advisor|employee|performer|people)/i) ||
            lowerQuery.match(/(best|highest|leading)\s+(advisor|employee|performer)/i) ||
            lowerQuery.match(/who\s+(are\s+the\s+)?(top|best|highest)/i) ||
            lowerQuery.match(/what\s+advisor\s+has\s+the\s+(highest|most|best|top)/i)) {
          
          isTopPerformerQuery = true;
          
          // Extract metric from query
          let metric = 'sales'; // default
          if (lowerQuery.includes('tire')) metric = 'retailTires';
          else if (lowerQuery.includes('oil')) metric = 'oilChange';
          else if (lowerQuery.includes('brake')) metric = 'brakeService';
          else if (lowerQuery.includes('alignment')) metric = 'alignments';
          else if (lowerQuery.includes('gross profit') || lowerQuery.includes('gp sales')) metric = 'gpSales';
          else if (lowerQuery.includes('sales') || lowerQuery.includes('revenue')) metric = 'sales';
          
          // Extract number of results requested
          const numberMatch = lowerQuery.match(/top\s+(\d+)/);
          const limit = numberMatch ? parseInt(numberMatch[1]) : 5;
          
          // Check if month is specified in query
          let targetMonth = new Date().getMonth() + 1;
          let targetYear = new Date().getFullYear();
          
          if (lowerQuery.includes('august')) targetMonth = 8;
          else if (lowerQuery.includes('july')) targetMonth = 7;
          else if (lowerQuery.includes('september')) targetMonth = 9;
          else if (lowerQuery.includes('october')) targetMonth = 10;
          
          console.log(`🎯 Detected top performer query: top ${limit} ${metric} performers for ${targetMonth}/${targetYear}`);
          
          console.log('🚫 POLICY ENFORCEMENT: getTopPerformers() disabled - use scorecard API endpoints instead');
          console.log(`   Query requested: top ${limit} ${metric} performers for ${targetMonth}/${targetYear}`);
          console.log('   Required: Use /api/scorecard/* endpoints for performance comparisons');
          topPerformersData = [];
        }
      }
      
      // Check if this is an organizational query (ONLY if not a performance or top performer query)
      let organizationalData = null;
      if (query && !isTopPerformerQuery && !isPerformanceQuery) {
        try {
          organizationalData = await this.analyzeOrganizationalQuery(query, userId);
        } catch (error) {
          console.warn('⚠️ Could not analyze organizational query:', error.message);
        }
      }
      
      // SAFEGUARD: Do NOT use getPerformanceData() for performance queries
      // All performance data now comes from validated scorecard endpoints
      
      // Get goals
      const goalsData = await this.getGoalsData(userId);
      
      // POLICY ENFORCEMENT: No market performance aggregations from raw data
      console.log('🚫 Skipping market performance data - use /api/scorecard/market/:marketId instead');
      const marketPerformanceData = [];
      
      // Get full market and store data with error handling
      let marketData = [];
      let storeData = [];
      let orgStructureData = [];
      
      try {
        marketData = userData.market_id ? 
          await this.getMarketData(userData.market_id) : [];
      } catch (error) {
        console.warn('⚠️ Could not get market data:', error.message);
        marketData = userData.market_id ? [{ 
          id: userData.market_id, 
          name: userData.market_name 
        }] : [];
      }
      
      try {
        storeData = userData.store_id ? 
          await this.getStoreData(userData.store_id) : [];
      } catch (error) {
        console.warn('⚠️ Could not get store data:', error.message);
        storeData = userData.store_id ? [{ 
          id: userData.store_id, 
          name: userData.store_name 
        }] : [];
      }
      
      try {
        orgStructureData = await this.getOrganizationalStructure(userData.market_id);
      } catch (error) {
        console.warn('⚠️ Could not get organizational structure:', error.message);
      }
      
      // Get all business intelligence data with error handling
      const vendorData = await this.getVendorData().catch(err => {
        console.warn('⚠️ Could not get vendor data:', err.message);
        return [];
      });
      
      const serviceData = await this.getServiceCatalog().catch(err => {
        console.warn('⚠️ Could not get service data:', err.message);
        return [];
      });
      
      const coachingData = await this.getCoachingHistory(userId, 5).catch(err => {
        console.warn('⚠️ Could not get coaching data:', err.message);
        return [];
      });
      
      const templateData = await this.getScorecardTemplates(userData.market_id).catch(err => {
        console.warn('⚠️ Could not get template data:', err.message);
        return [];
      });
      
      // POLICY ENFORCEMENT: No peer comparison data from raw performance_data
      console.log('🚫 Skipping peer comparison data - use scorecard API endpoints instead');
      let peerData = [];


      const context = {
        user: {
          ...userData,
          market: userData.market_name || userData.market,
          store: userData.store_name || userData.store
        },
        performance: {
          // POLICY ENFORCEMENT: Only validated scorecard data
          validated_data: specificPersonPerformanceData || performanceData,
          is_performance_query: isPerformanceQuery,
          is_specific_person_query: !!specificPersonQuery,
          specific_person_name: specificPersonQuery,
          data_source: 'validated_scorecard_api_enforced',
          policy_compliant: true,
          
          // FORBIDDEN: Legacy fields permanently disabled to prevent raw data access
          recent_data: null, // PERMANENTLY DISABLED - use validated_data only
          latest: null, // PERMANENTLY DISABLED - use validated_data only  
          timeframe: null, // PERMANENTLY DISABLED - use validated_data.metadata.retrievedAt
          store_name: null, // PERMANENTLY DISABLED - use user context instead
          
          // Policy enforcement metadata
          enforcement_level: 'strict',
          authorized_endpoints_only: true,
          raw_spreadsheet_access: false,
          manual_data_injection: false
        },
        goals: goalsData,
        organizational: {
          structure: orgStructureData,
          query_specific_data: organizationalData,
          is_org_query: organizationalData !== null
        },
        user_behavior: {
          preferences: userPreferences,
          knowledge_patterns: userKnowledgePatterns,
          common_queries: userKnowledgePatterns.map(p => p.knowledge_domain)
        },
        business_intelligence: {
          markets: marketData,
          market_performance: marketPerformanceData,
          stores: storeData,
          vendors: vendorData,
          services: serviceData,
          scorecard_templates: templateData
        },
        coaching: {
          recent_threads: coachingData
        },
        benchmarking: {
          peers: peerData,
          top_performers: topPerformersData,
          is_top_performer_query: isTopPerformerQuery
        },
        query_context: query
      };

      console.log('✅ Comprehensive context built successfully');
      return context;

    } catch (error) {
      console.error('❌ Error building comprehensive context:', error);
      throw error;
    }
  }
  /**
   * Get store rankings for AI queries
   * Supports ranking stores by various performance metrics
   */
  async getStoreRankings(metric = 'alignments', month = null, year = null) {
    try {
      console.log(`🏆 Getting store rankings by ${metric} for ${month}/${year}`);
      
      // Use current month if not specified
      const currentDate = new Date();
      const mtdMonth = month || (currentDate.getMonth() + 1);
      const mtdYear = year || currentDate.getFullYear();
      
      // Use the validated scorecard API
      const { getValidatedScorecardData } = require('../utils/scorecardDataAccess');
      
      // For rankings, we need to construct the endpoint differently
      const apiBaseURL = process.env.API_BASE_URL || 'http://maintenance-club-api:5000';
      const endpoint = `${apiBaseURL}/api/scorecard/rankings/stores?metric=${metric}&mtdMonth=${mtdMonth}&mtdYear=${mtdYear}`;
      
      console.log(`📊 Fetching rankings from: ${endpoint}`);
      
      // Generate service token for internal API access
      const jwt = require('jsonwebtoken');
      const serviceToken = jwt.sign(
        { 
          id: 1, 
          role: 'admin', 
          service: 'ai-validation-middleware',
          internal: true 
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '5m' }
      );
      
      const axios = require('axios');
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.rankings) {
        console.log(`✅ Retrieved ${response.data.rankings.length} stores in ranking`);
        return {
          success: true,
          data: response.data,
          source: 'validated_scorecard_api'
        };
      } else {
        throw new Error('No ranking data in response');
      }
      
    } catch (error) {
      console.error('❌ Error getting store rankings:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Detect if query is asking for store rankings
   */
  isStoreRankingQuery(query) {
    const lowerQuery = query.toLowerCase();
    const rankingIndicators = [
      'ranking', 'rank', 'top stores', 'best stores', 
      'stores by', 'which stores', 'store performance',
      'compare stores', 'store leaderboard'
    ];
    
    return rankingIndicators.some(indicator => lowerQuery.includes(indicator));
  }
}

module.exports = AIDataService;