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
   * DEPRECATED: Use getValidatedScorecardResponse() instead
   * Get performance data from latest MTD spreadsheets
   */
  async getPerformanceData(userId, limit = 3) {
    console.warn('⚠️ DEPRECATED: getPerformanceData() called. Use getValidatedScorecardResponse() instead.');
    try {
      // Get latest upload per month for this advisor (since spreadsheets are MTD)
      const result = await this.pool.query(`
        WITH latest_per_month AS (
          SELECT 
            EXTRACT(YEAR FROM upload_date) as year,
            EXTRACT(MONTH FROM upload_date) as month,
            MAX(upload_date) as latest_date
          FROM performance_data
          WHERE advisor_user_id = $1 AND data_type = 'services'
          GROUP BY EXTRACT(YEAR FROM upload_date), EXTRACT(MONTH FROM upload_date)
          ORDER BY year DESC, month DESC
          LIMIT $2
        )
        SELECT 
          pd.upload_date, 
          pd.data, 
          pd.store_id,
          pd.data_type,
          s.name as store_name,
          m.name as market_name,
          'latest_mtd' as data_source
        FROM performance_data pd
        LEFT JOIN stores s ON pd.store_id = s.id
        LEFT JOIN markets m ON s.market_id = m.id
        JOIN latest_per_month lpm ON pd.upload_date = lpm.latest_date
        WHERE pd.advisor_user_id = $1 AND pd.data_type = 'services'
        ORDER BY pd.upload_date DESC
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting performance data:', error);
      throw error;
    }
  }

  /**
   * Get validated scorecard data using the single source of truth API endpoints
   * This is the ONLY method that should be used for performance-related queries
   */
  async getValidatedScorecardResponse(targetType, targetId, contextUserId = null) {
    try {
      console.log(`📊 Getting validated scorecard data: ${targetType}/${targetId}`);
      
      const axios = require('axios');
      const baseURL = process.env.API_BASE_URL || 'http://localhost:5000';
      
      let endpoint;
      let endpointDescription;
      
      switch (targetType.toLowerCase()) {
        case 'advisor':
        case 'user':
          endpoint = `${baseURL}/api/scorecard/advisor/${targetId}`;
          endpointDescription = `advisor scorecard for user ID ${targetId}`;
          break;
        case 'store':
          endpoint = `${baseURL}/api/scorecard/store/${targetId}`;
          endpointDescription = `store scorecard for store ID ${targetId}`;
          break;
        case 'market':
          endpoint = `${baseURL}/api/scorecard/market/${targetId}`;
          endpointDescription = `market scorecard for market ID ${targetId}`;
          break;
        default:
          throw new Error(`Invalid scorecard target type: ${targetType}. Use 'advisor', 'store', or 'market'.`);
      }

      console.log(`🔗 Fetching ${endpointDescription} from: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        console.log(`✅ Successfully retrieved validated ${endpointDescription}`);
        return {
          success: true,
          data: response.data.data,
          source: 'validated_scorecard_api',
          endpoint: endpoint,
          target_type: targetType,
          target_id: targetId,
          retrieved_at: new Date().toISOString()
        };
      } else {
        throw new Error(`Invalid response from scorecard API: ${response.data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Error getting validated scorecard response for ${targetType}/${targetId}:`, error.message);
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
   * Get peer comparison data for advisor benchmarking
   */
  async getPeerComparison(userId, marketId = null, storeId = null, limit = 10) {
    try {
      let peerQuery;
      let params = [userId];

      if (storeId) {
        // Compare within same store
        peerQuery = `
          WITH user_performance AS (
            SELECT 
              pd.advisor_user_id,
              u.first_name || ' ' || u.last_name as advisor_name,
              pd.data,
              pd.upload_date,
              ROW_NUMBER() OVER (PARTITION BY pd.advisor_user_id ORDER BY pd.upload_date DESC) as rn
            FROM performance_data pd
            JOIN users u ON pd.advisor_user_id = u.id
            JOIN user_store_assignments usa ON u.id::text = usa.user_id
            WHERE usa.store_id = (
              SELECT usa2.store_id 
              FROM user_store_assignments usa2 
              WHERE usa2.user_id = $1::text
              LIMIT 1
            )
            AND pd.data_type = 'services'
            AND pd.advisor_user_id != $1
          )
          SELECT * FROM user_performance WHERE rn = 1 LIMIT $2
        `;
        params.push(limit);
      } else if (marketId) {
        // Compare within same market
        peerQuery = `
          WITH user_performance AS (
            SELECT 
              pd.advisor_user_id,
              u.first_name || ' ' || u.last_name as advisor_name,
              pd.data,
              pd.upload_date,
              s.name as store_name,
              ROW_NUMBER() OVER (PARTITION BY pd.advisor_user_id ORDER BY pd.upload_date DESC) as rn
            FROM performance_data pd
            JOIN users u ON pd.advisor_user_id = u.id
            JOIN user_market_assignments uma ON u.id::text = uma.user_id
            JOIN user_store_assignments usa ON u.id::text = usa.user_id
            JOIN stores s ON usa.store_id::integer = s.id
            WHERE uma.market_id = $2::text
            AND pd.data_type = 'services'
            AND pd.advisor_user_id != $1
          )
          SELECT * FROM user_performance WHERE rn = 1 LIMIT $3
        `;
        params.push(marketId.toString(), limit);
      } else {
        // Compare across all advisors
        peerQuery = `
          WITH user_performance AS (
            SELECT 
              pd.advisor_user_id,
              u.first_name || ' ' || u.last_name as advisor_name,
              pd.data,
              pd.upload_date,
              s.name as store_name,
              m.name as market_name,
              ROW_NUMBER() OVER (PARTITION BY pd.advisor_user_id ORDER BY pd.upload_date DESC) as rn
            FROM performance_data pd
            JOIN users u ON pd.advisor_user_id = u.id
            LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
            LEFT JOIN stores s ON usa.store_id::integer = s.id
            LEFT JOIN markets m ON s.market_id = m.id
            WHERE pd.data_type = 'services'
            AND pd.advisor_user_id != $1
          )
          SELECT * FROM user_performance WHERE rn = 1 LIMIT $2
        `;
        params.push(limit);
      }

      const result = await this.pool.query(peerQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting peer comparison:', error);
      throw error;
    }
  }

  /**
   * Get market-level performance from latest MTD spreadsheet
   */
  async getMarketPerformanceData(marketId = null, month = null, year = null) {
    try {
      let marketPerfQuery;
      let params = [];

      if (marketId && month && year) {
        // Latest MTD spreadsheet for specific market/month/year
        marketPerfQuery = `
          WITH latest_upload AS (
            SELECT MAX(upload_date) as latest_date
            FROM performance_data pd
            JOIN stores s ON pd.store_id = s.id
            JOIN markets m ON s.market_id = m.id
            WHERE pd.data_type = 'services' 
              AND m.id = $1
              AND EXTRACT(MONTH FROM pd.upload_date) = $2
              AND EXTRACT(YEAR FROM pd.upload_date) = $3
          )
          SELECT 
            m.name as market_name,
            pd.upload_date,
            COUNT(DISTINCT pd.advisor_user_id) as advisor_count,
            SUM((pd.data->>'sales')::int) as total_sales,
            AVG((pd.data->>'gpPercent')::float) as avg_gp_percent,
            SUM((pd.data->>'invoices')::int) as total_invoices,
            AVG((pd.data->>'avgSpend')::float) as avg_ticket_size,
            'latest_mtd' as data_source
          FROM performance_data pd
          JOIN stores s ON pd.store_id = s.id
          JOIN markets m ON s.market_id = m.id
          JOIN latest_upload lu ON pd.upload_date = lu.latest_date
          WHERE pd.data_type = 'services' 
            AND m.id = $1
            AND EXTRACT(MONTH FROM pd.upload_date) = $2
            AND EXTRACT(YEAR FROM pd.upload_date) = $3
          GROUP BY m.name, pd.upload_date
        `;
        params = [marketId, month, year];
      } else if (marketId) {
        // Latest MTD spreadsheet for specific market
        marketPerfQuery = `
          WITH latest_upload AS (
            SELECT MAX(upload_date) as latest_date
            FROM performance_data pd
            JOIN stores s ON pd.store_id = s.id
            JOIN markets m ON s.market_id = m.id
            WHERE pd.data_type = 'services' AND m.id = $1
          )
          SELECT 
            m.name as market_name,
            pd.upload_date,
            COUNT(DISTINCT pd.advisor_user_id) as advisor_count,
            SUM((pd.data->>'sales')::int) as total_sales,
            AVG((pd.data->>'gpPercent')::float) as avg_gp_percent,
            SUM((pd.data->>'invoices')::int) as total_invoices,
            AVG((pd.data->>'avgSpend')::float) as avg_ticket_size,
            'latest_mtd' as data_source
          FROM performance_data pd
          JOIN stores s ON pd.store_id = s.id
          JOIN markets m ON s.market_id = m.id
          JOIN latest_upload lu ON pd.upload_date = lu.latest_date
          WHERE pd.data_type = 'services' AND m.id = $1
          GROUP BY m.name, pd.upload_date
        `;
        params = [marketId];
      } else {
        // Latest MTD spreadsheet for all markets
        marketPerfQuery = `
          WITH latest_upload_per_market AS (
            SELECT 
              m.id as market_id,
              MAX(pd.upload_date) as latest_date
            FROM performance_data pd
            JOIN stores s ON pd.store_id = s.id
            JOIN markets m ON s.market_id = m.id
            WHERE pd.data_type = 'services'
            GROUP BY m.id
          )
          SELECT 
            m.name as market_name,
            m.id as market_id,
            pd.upload_date,
            COUNT(DISTINCT pd.advisor_user_id) as advisor_count,
            SUM((pd.data->>'sales')::int) as total_sales,
            AVG((pd.data->>'gpPercent')::float) as avg_gp_percent,
            SUM((pd.data->>'invoices')::int) as total_invoices,
            AVG((pd.data->>'avgSpend')::float) as avg_ticket_size,
            'latest_mtd' as data_source
          FROM performance_data pd
          JOIN stores s ON pd.store_id = s.id
          JOIN markets m ON s.market_id = m.id
          JOIN latest_upload_per_market lum ON m.id = lum.market_id AND pd.upload_date = lum.latest_date
          WHERE pd.data_type = 'services'
          GROUP BY m.name, m.id, pd.upload_date
          ORDER BY pd.upload_date DESC
        `;
      }

      const result = await this.pool.query(marketPerfQuery, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting market performance data:', error);
      throw error;
    }
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
   * Get store history for a specific user and timeframe using performance data
   */
  async getUserStoreHistoryByTimeframe(userName, month, year) {
    try {
      // First find the user
      const userResult = await this.pool.query(`
        SELECT u.id, u.first_name, u.last_name, u.role
        FROM users u
        WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($1)
          AND u.status = 'active'
        LIMIT 1
      `, [`%${userName}%`]);

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];

      // Get stores worked at during the specific timeframe from performance_data
      const result = await this.pool.query(`
        SELECT DISTINCT
          pd.store_id,
          s.name as store_name,
          s.city,
          s.state,
          m.name as market_name,
          COUNT(pd.id) as record_count,
          MIN(pd.upload_date) as first_date,
          MAX(pd.upload_date) as last_date
        FROM performance_data pd
        LEFT JOIN stores s ON pd.store_id = s.id
        LEFT JOIN markets m ON s.market_id = m.id
        WHERE pd.advisor_user_id = $1
          AND EXTRACT(YEAR FROM pd.upload_date) = $2
          AND EXTRACT(MONTH FROM pd.upload_date) = $3
        GROUP BY pd.store_id, s.name, s.city, s.state, m.name
        ORDER BY record_count DESC, s.name
      `, [user.id, year, month]);

      // Format the results to include user info
      return result.rows.map(row => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        store_name: row.store_name,
        city: row.city,
        state: row.state,
        market_name: row.market_name,
        performance_records: row.record_count,
        first_record: row.first_date,
        last_record: row.last_date,
        timeframe: `${month}/${year}`
      }));
    } catch (error) {
      console.error('❌ Error getting user store history by timeframe:', error);
      throw error;
    }
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
    const roleLocationMatch = lowerQuery.match(/(?:what|which)\s+(managers?|advisors?|employees?)\s+(?:work|are)\s+(?:in|at)\s+(?:the\s+)?([a-zA-Z\s]+?)(?:\s+store)?(?:\s*[\?.,!]|$)/i);
    if (roleLocationMatch) {
      const role = roleLocationMatch[1];
      const storeName = roleLocationMatch[2].trim();
      console.log(`🔍 Detected role+location query: ${role} at "${storeName}"`);
      return await this.getStoreEmployeesByRole(storeName, role);
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
        return await this.getUserStoreHistoryByTimeframe(name, targetMonth, targetYear);
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
   * Get specific month/year performance data (for direct queries like "July sales")
   */
  async getMonthYearPerformance(marketName, month, year) {
    try {
      const result = await this.pool.query(`
        WITH latest_upload AS (
          SELECT MAX(upload_date) as latest_date
          FROM performance_data pd
          WHERE pd.data_type = 'services'
            AND EXTRACT(MONTH FROM pd.upload_date) = $2
            AND EXTRACT(YEAR FROM pd.upload_date) = $3
            AND pd.data->>'market' = $1
        )
        SELECT 
          pd.data->>'market' as market_name,
          TO_CHAR(pd.upload_date, 'Month YYYY') as period,
          pd.upload_date,
          COUNT(DISTINCT pd.advisor_user_id) as advisor_count,
          SUM((pd.data->>'sales')::int) as total_sales,
          AVG((pd.data->>'gpPercent')::float) as avg_gp_percent,
          SUM((pd.data->>'invoices')::int) as total_invoices,
          'final_mtd' as data_source
        FROM performance_data pd
        JOIN latest_upload lu ON pd.upload_date = lu.latest_date
        WHERE pd.data_type = 'services'
          AND pd.data->>'market' = $1
        GROUP BY pd.data->>'market', pd.upload_date
      `, [marketName, month, year]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting month/year performance:', error);
      throw error;
    }
  }

  /**
   * Get top performers by specific metric for a given month
   */
  async getTopPerformers(metric, marketName, month, year, limit = 5) {
    try {
      // Map common metric names to JSON field names
      const metricMap = {
        'tire': 'retailTires',
        'tires': 'retailTires',
        'tire sales': 'retailTires',
        'oil change': 'oilChange',
        'oil changes': 'oilChange',
        'sales': 'sales',
        'revenue': 'sales',
        'gp': 'gpPercent',
        'gross profit': 'gpPercent',
        'gpSales': 'gpSales',
        'gp sales': 'gpSales',
        'gross profit sales': 'gpSales',
        'alignments': 'alignments',
        'brake service': 'brakeService',
        'brakes': 'brakeService'
      };

      const jsonField = metricMap[metric.toLowerCase()] || metric;
      
      const result = await this.pool.query(`
        WITH latest_upload AS (
          SELECT MAX(upload_date) as latest_date
          FROM performance_data pd
          WHERE pd.data_type = 'services'
            AND EXTRACT(MONTH FROM pd.upload_date) = $2
            AND EXTRACT(YEAR FROM pd.upload_date) = $3
            AND pd.data->>'market' = $1
        )
        SELECT DISTINCT
          pd.advisor_user_id,
          u.first_name || ' ' || u.last_name as advisor_name,
          pd.data->>'storeName' as store,
          (pd.data->>$4)::float as metric_value,
          (pd.data->>'sales')::int as total_sales,
          (pd.data->>'gpPercent')::float as gp_percent,
          pd.upload_date
        FROM performance_data pd
        JOIN users u ON pd.advisor_user_id = u.id
        JOIN latest_upload lu ON pd.upload_date = lu.latest_date
        WHERE pd.data_type = 'services'
          AND pd.data->>'market' = $1
          AND pd.data->>$4 IS NOT NULL
          AND (pd.data->>$4)::float > 0
        ORDER BY (pd.data->>$4)::float DESC
        LIMIT $5
      `, [marketName, month, year, jsonField, limit]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting top performers:', error);
      throw error;
    }
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
      
      // PERFORMANCE DATA: Use ONLY validated scorecard endpoints
      if (isPerformanceQuery) {
        console.log('🎯 Performance query detected - using validated scorecard endpoints only');
        
        // Check if asking about specific person's performance
        if (query) {
          const lowerQuery = query.toLowerCase();
          
          // Check for person-specific performance patterns
          let personPerfMatch = lowerQuery.match(/(?:what\s+(?:is|does|are)|how\s+(?:is|does|are))\s+([a-zA-Z\s]+?)(?:'s|\s+)(?:performance|doing|sales|numbers)/i);
          
          if (!personPerfMatch) {
            personPerfMatch = lowerQuery.match(/(?:show\s+(?:me\s+)?|give\s+(?:me\s+)?|get\s+(?:me\s+)?)([a-zA-Z\s]+?)(?:s)?\s+(?:[\d\s,]+\s+)?(?:complete\s+)?(?:scorecard|score\s+card|metrics|performance|breakdown)/i);
          }
          
          if (!personPerfMatch) {
            personPerfMatch = lowerQuery.match(/([a-zA-Z\s]+?)(?:'s|s')\s+(?:total\s+)?(?:retail\s+|monthly\s+|overall\s+)?(?:sales|performance|numbers|alignments|tires?|revenue|metrics|data)/i);
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
            
            try {
              const personResults = await this.searchUsers(personName, 'name');
              if (personResults.length > 0) {
                const personId = personResults[0].id;
                console.log(`📊 Getting VALIDATED scorecard data for ${personResults[0].first_name} ${personResults[0].last_name} (ID: ${personId})`);
                
                specificPersonQuery = personName;
                // Use VALIDATED scorecard endpoint instead of raw performance data
                specificPersonPerformanceData = await this.getValidatedScorecardResponse('advisor', personId, userId);
              }
            } catch (error) {
              console.warn('⚠️ Could not get specific person scorecard:', error.message);
            }
          }
        }
        
        // Get performance data for the requesting user using VALIDATED scorecard endpoint
        if (!specificPersonPerformanceData) {
          console.log(`📊 Getting VALIDATED scorecard data for requesting user (ID: ${userId})`);
          performanceData = await this.getValidatedScorecardResponse('advisor', userId, userId);
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
          
          try {
            topPerformersData = await this.getTopPerformers(
              metric, 
              userData.market_name || 'Tire South - Tekmetric',
              targetMonth,
              targetYear,
              limit
            );
            console.log(`🏆 Found ${topPerformersData.length} top performers for ${metric}`);
          } catch (error) {
            console.error('⚠️ Could not get top performers:', error.message);
          }
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
      
      // Get market performance aggregations (focus on MTD data)
      const marketPerformanceData = userData.market_id ? 
        await this.getMarketPerformanceData(userData.market_id) : [];
      
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
      
      // Get peer comparison data (safely)
      let peerData = [];
      try {
        peerData = await this.getPeerComparison(userId, userData.market_id, userData.store_id, 5);
      } catch (error) {
        console.warn('⚠️ Could not get peer data:', error.message);
      }


      const context = {
        user: {
          ...userData,
          market: userData.market_name || userData.market,
          store: userData.store_name || userData.store
        },
        performance: {
          // Use validated scorecard data when available
          validated_data: specificPersonPerformanceData || performanceData,
          is_performance_query: isPerformanceQuery,
          is_specific_person_query: !!specificPersonQuery,
          specific_person_name: specificPersonQuery,
          data_source: 'validated_scorecard_api',
          // Legacy fields for backward compatibility (but marked as deprecated)
          recent_data: [], // DEPRECATED: Use validated_data instead
          latest: {}, // DEPRECATED: Use validated_data instead
          timeframe: null, // DEPRECATED: Use validated_data.retrieved_at instead
          store_name: null // DEPRECATED: Use user context instead
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
}

module.exports = AIDataService;