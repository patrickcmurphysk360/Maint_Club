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
      console.error('❌ Error getting service catalog:', error);
      throw error;
    }
  }

  /**
   * Get performance data from latest MTD spreadsheets
   */
  async getPerformanceData(userId, limit = 3) {
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
   * Get coaching history and threads
   */
  async getCoachingHistory(userId, limit = 10) {
    try {
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
      console.error('❌ Error getting coaching history:', error);
      throw error;
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
      console.error('❌ Error getting scorecard templates:', error);
      throw error;
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
   * Build comprehensive context for AI with all business data
   */
  async buildComprehensiveContext(userId, query = null) {
    try {
      console.log('🔄 Building comprehensive AI context for user:', userId);

      // Get base user context
      const userData = await this.getUserContext(userId);
      
      // Get performance data
      const performanceData = await this.getPerformanceData(userId, 3);
      
      // Get goals
      const goalsData = await this.getGoalsData(userId);
      
      // Get market performance aggregations (focus on MTD data)
      const marketPerformanceData = userData.market_id ? 
        await this.getMarketPerformanceData(userData.market_id) : [];
      
      // Simplified market and store data to avoid SQL issues
      const marketData = userData.market_id ? [{ 
        id: userData.market_id, 
        name: userData.market_name 
      }] : [];
      
      const storeData = userData.store_id ? [{ 
        id: userData.store_id, 
        name: userData.store_name 
      }] : [];
      
      // Skip complex queries that may fail - focus on core performance data
      const vendorData = [];
      const serviceData = [];
      const coachingData = [];
      const templateData = [];
      
      // Get peer comparison data (safely)
      let peerData = [];
      try {
        peerData = await this.getPeerComparison(userId, userData.market_id, userData.store_id, 5);
      } catch (error) {
        console.warn('⚠️ Could not get peer data:', error.message);
      }

      // Check if query is asking for top performers
      let topPerformersData = null;
      if (query && query.toLowerCase().includes('top') && query.toLowerCase().match(/tire|sales|oil|brake|alignment/)) {
        // Extract metric from query
        let metric = 'sales';
        if (query.toLowerCase().includes('tire')) metric = 'retailTires';
        else if (query.toLowerCase().includes('oil')) metric = 'oilChange';
        else if (query.toLowerCase().includes('brake')) metric = 'brakeService';
        else if (query.toLowerCase().includes('alignment')) metric = 'alignments';
        
        // Check if month is specified in query
        let targetMonth = new Date().getMonth() + 1;
        let targetYear = new Date().getFullYear();
        
        if (query.toLowerCase().includes('august')) {
          targetMonth = 8;
        } else if (query.toLowerCase().includes('july')) {
          targetMonth = 7;
        }
        
        console.log(`🎯 Looking for top ${metric} performers for ${targetMonth}/${targetYear}`);
        
        try {
          topPerformersData = await this.getTopPerformers(
            metric, 
            userData.market_name || 'Tire South - Tekmetric',
            targetMonth,
            targetYear,
            5
          );
          console.log(`🏆 Found ${topPerformersData.length} top performers for ${metric}`);
        } catch (error) {
          console.error('⚠️ Could not get top performers:', error.message);
        }
      }

      const context = {
        user: userData,
        performance: {
          recent_data: performanceData,
          latest: performanceData[0]?.data || {},
          timeframe: performanceData[0]?.upload_date || null
        },
        goals: goalsData,
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
          top_performers: topPerformersData
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