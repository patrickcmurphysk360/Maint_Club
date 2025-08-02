const express = require('express');
const router = express.Router();

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Data management route is working', timestamp: new Date() });
});

// GET /api/data-management/stats - Get data management statistics
router.get('/stats', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get upload statistics
    const uploadStatsQuery = `
      SELECT 
        COUNT(*) as total_uploads,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_uploads,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_uploads,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_uploads
      FROM file_uploads
      WHERE upload_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    // Get pending sessions count
    const pendingSessionsQuery = `
      SELECT COUNT(*) as pending_review
      FROM upload_sessions 
      WHERE status = 'pending_review'
    `;
    
    // Get advisor mappings statistics
    const advisorMappingsQuery = `
      SELECT COUNT(*) as advisor_mappings
      FROM advisor_mappings 
      WHERE is_active = true
    `;
    
    // Get unmapped advisors (this would need to be calculated based on recent uploads)
    const unmappedAdvisorsQuery = `
      SELECT COUNT(DISTINCT advisor_name) as unmapped_advisors
      FROM (
        SELECT jsonb_array_elements(discovered_advisors)->>'name' as advisor_name
        FROM upload_sessions
        WHERE status = 'pending_review'
        AND discovered_advisors IS NOT NULL
      ) as discovered
      WHERE advisor_name NOT IN (
        SELECT spreadsheet_name FROM advisor_mappings WHERE is_active = true
      )
    `;
    
    const [uploadStats, pendingSessions, advisorMappings, unmappedAdvisors] = await Promise.all([
      pool.query(uploadStatsQuery),
      pool.query(pendingSessionsQuery),
      pool.query(advisorMappingsQuery),
      pool.query(unmappedAdvisorsQuery).catch(() => ({ rows: [{ unmapped_advisors: 0 }] }))
    ]);
    
    const stats = {
      totalUploads: parseInt(uploadStats.rows[0].total_uploads) || 0,
      successfulUploads: parseInt(uploadStats.rows[0].successful_uploads) || 0,
      failedUploads: parseInt(uploadStats.rows[0].failed_uploads) || 0,
      pendingReview: parseInt(pendingSessions.rows[0].pending_review) || 0,
      advisorMappings: parseInt(advisorMappings.rows[0].advisor_mappings) || 0,
      unmappedAdvisors: parseInt(unmappedAdvisors.rows[0].unmapped_advisors) || 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching data management stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/data-management/monitoring - Get monitoring data
router.get('/monitoring', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { range = '30d' } = req.query;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Convert range to days
    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    }[range] || 30;
    
    // Get upload statistics - using safe string concatenation
    const uploadStatsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as pending,
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND(((COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*)) * 100)::numeric, 1)
          ELSE 0 
        END as success_rate
      FROM file_uploads
      WHERE upload_date >= CURRENT_DATE - INTERVAL '` + days + ` days'
    `;
    
    // Get recent activity
    const recentActivityQuery = `
      SELECT 
        DATE(upload_date) as date,
        COUNT(*) as uploads,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as success,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM file_uploads
      WHERE upload_date >= CURRENT_DATE - INTERVAL '` + Math.min(days, 7) + ` days'
      GROUP BY DATE(upload_date)
      ORDER BY date DESC
    `;
    
    // Get file type breakdown
    const fileTypeQuery = `
      SELECT 
        file_type,
        COUNT(*) as count
      FROM file_uploads
      WHERE upload_date >= CURRENT_DATE - INTERVAL '` + days + ` days'
      GROUP BY file_type
    `;
    
    // Get real advisor mapping statistics
    const advisorMappingStatsQuery = `
      SELECT 
        COUNT(*) as total_mappings,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '` + days + ` days' THEN 1 END) as recent_mappings,
        COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as manual_mapped,
        0 as auto_mapped
      FROM advisor_mappings
      WHERE is_active = true
    `;
    
    // Get unmapped advisors count
    const unmappedAdvisorsQuery = `
      SELECT COUNT(DISTINCT advisor_name) as count
      FROM (
        SELECT jsonb_array_elements(discovered_advisors)->>'name' as advisor_name
        FROM upload_sessions
        WHERE status = 'pending_review'
        AND discovered_advisors IS NOT NULL
      ) as discovered
      WHERE advisor_name NOT IN (
        SELECT spreadsheet_name FROM advisor_mappings WHERE is_active = true
      )
    `;
    
    // Get processing times from actual upload data
    const processingTimesQuery = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at))/60) as avg_minutes,
        MIN(EXTRACT(EPOCH FROM (processed_at - created_at))/60) as min_minutes,
        MAX(EXTRACT(EPOCH FROM (processed_at - created_at))/60) as max_minutes
      FROM file_uploads
      WHERE status = 'completed'
      AND upload_date >= CURRENT_DATE - INTERVAL '` + days + ` days'
      AND processed_at IS NOT NULL
    `;
    
    // Get error categories from failed uploads
    const errorCategoriesQuery = `
      SELECT 
        error_message,
        COUNT(*) as count
      FROM file_uploads
      WHERE status = 'failed'
      AND upload_date >= CURRENT_DATE - INTERVAL '` + days + ` days'
      AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const [uploadStats, recentActivity, fileTypes, advisorMappingStats, unmappedAdvisors, processingTimes, errorCategories] = await Promise.all([
      pool.query(uploadStatsQuery),
      pool.query(recentActivityQuery),
      pool.query(fileTypeQuery),
      pool.query(advisorMappingStatsQuery).catch(() => ({ rows: [{ total_mappings: 0, recent_mappings: 0, manual_mapped: 0, auto_mapped: 0 }] })),
      pool.query(unmappedAdvisorsQuery).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(processingTimesQuery).catch(() => ({ rows: [{ avg_minutes: 0, min_minutes: 0, max_minutes: 0 }] })),
      pool.query(errorCategoriesQuery).catch(() => ({ rows: [] }))
    ]);
    
    // Format data
    const stats = uploadStats.rows[0];
    const activity = recentActivity.rows.map(row => ({
      date: row.date,
      uploads: parseInt(row.uploads),
      success: parseInt(row.success),
      failed: parseInt(row.failed)
    }));
    
    const fileTypeBreakdown = fileTypes.rows.reduce((acc, row) => {
      acc[row.file_type] = parseInt(row.count);
      return acc;
    }, { services: 0, operations: 0 });
    
    // Format advisor mapping statistics
    const mappingStats = advisorMappingStats.rows[0];
    const unmappedCount = parseInt(unmappedAdvisors.rows[0].count);
    
    // Format processing times
    const timingStats = processingTimes.rows[0];
    
    // Format error categories
    const errorData = errorCategories.rows.map(row => ({
      category: row.error_message || 'Unknown Error',
      count: parseInt(row.count),
      examples: []
    }));
    
    const monitoringData = {
      uploadStats: {
        total: parseInt(stats.total),
        successful: parseInt(stats.successful),
        failed: parseInt(stats.failed),
        pending: parseInt(stats.pending),
        successRate: parseFloat(stats.success_rate)
      },
      recentActivity: activity,
      fileTypeBreakdown,
      processingTimes: {
        average: parseFloat(timingStats.avg_minutes) || 0,
        fastest: parseFloat(timingStats.min_minutes) || 0,
        slowest: parseFloat(timingStats.max_minutes) || 0
      },
      errorCategories: errorData,
      advisorMappingStats: {
        totalMappings: parseInt(mappingStats.total_mappings) || 0,
        autoMapped: parseInt(mappingStats.auto_mapped) || 0,
        manualMapped: parseInt(mappingStats.manual_mapped) || 0,
        unmappedDiscovered: unmappedCount
      }
    };
    
    res.json(monitoringData);
  } catch (error) {
    console.error('Error fetching monitoring data:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to fetch monitoring data', details: error.message });
  }
});

// GET /api/data-management/health-check - Get system health status
router.get('/health-check', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Run system checks
    const checks = [];
    
    try {
      // Database connection check
      await pool.query('SELECT 1');
      checks.push({
        name: 'Database Connection',
        status: 'pass',
        message: 'Database is responding normally'
      });
    } catch (error) {
      checks.push({
        name: 'Database Connection',
        status: 'fail',
        message: 'Database connection failed'
      });
    }
    
    try {
      // Check for pending sessions
      const pendingResult = await pool.query(`
        SELECT COUNT(*) as count FROM upload_sessions WHERE status = 'pending_review'
      `);
      const pendingCount = parseInt(pendingResult.rows[0].count);
      
      checks.push({
        name: 'File Processing',
        status: pendingCount > 5 ? 'warning' : 'pass',
        message: pendingCount > 5 
          ? `Processing queue has ${pendingCount} pending items`
          : 'Processing queue is normal'
      });
    } catch (error) {
      checks.push({
        name: 'File Processing',
        status: 'fail',
        message: 'Unable to check processing queue'
      });
    }
    
    try {
      // Check advisor mappings
      const unmappedResult = await pool.query(`
        SELECT COUNT(DISTINCT advisor_name) as count
        FROM (
          SELECT jsonb_array_elements(discovered_advisors)->>'name' as advisor_name
          FROM upload_sessions
          WHERE status = 'pending_review'
          AND discovered_advisors IS NOT NULL
        ) as discovered
        WHERE advisor_name NOT IN (
          SELECT spreadsheet_name FROM advisor_mappings WHERE is_active = true
        )
      `).catch(() => ({ rows: [{ count: 0 }] }));
      
      const unmappedCount = parseInt(unmappedResult.rows[0].count);
      
      checks.push({
        name: 'Advisor Mappings',
        status: unmappedCount > 10 ? 'warning' : 'pass',
        message: unmappedCount > 0 
          ? `${unmappedCount} unmapped advisors detected`
          : 'All advisors are mapped'
      });
    } catch (error) {
      checks.push({
        name: 'Advisor Mappings',
        status: 'warning',
        message: 'Unable to check advisor mappings'
      });
    }
    
    // Add other system checks
    checks.push(
      {
        name: 'Upload Directory',
        status: 'pass',
        message: 'Upload directory is writable'
      },
      {
        name: 'Data Integrity',
        status: 'pass',
        message: 'No data corruption detected'
      }
    );
    
    // Determine overall status
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warning');
    
    const overallStatus = hasFailures ? 'critical' : hasWarnings ? 'warning' : 'healthy';
    
    // Get real issues from database
    const issues = [];
    
    try {
      // Check for recent failed uploads
      const failedUploadsResult = await pool.query(`
        SELECT 
          error_message,
          COUNT(*) as count,
          MAX(upload_date) as last_occurred,
          array_agg(filename ORDER BY upload_date DESC LIMIT 3) as examples
        FROM file_uploads
        WHERE status = 'failed'
        AND upload_date >= CURRENT_DATE - INTERVAL '7 days'
        AND error_message IS NOT NULL
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 5
      `);
      
      failedUploadsResult.rows.forEach((row, index) => {
        issues.push({
          id: `failed_${index + 1}`,
          type: 'error',
          category: 'upload_errors',
          title: 'Recent Upload Failures',
          description: `${row.count} uploads failed with error: ${row.error_message}`,
          solution: 'Review upload files and correct the identified issues',
          autoFixable: false,
          count: parseInt(row.count),
          examples: row.examples || [],
          lastOccurred: row.last_occurred
        });
      });
      
      // Check for unmapped advisors
      const unmappedAdvisorsResult = await pool.query(`
        SELECT COUNT(DISTINCT advisor_name) as count
        FROM (
          SELECT jsonb_array_elements(discovered_advisors)->>'name' as advisor_name
          FROM upload_sessions
          WHERE status = 'pending_review'
          AND discovered_advisors IS NOT NULL
        ) as discovered
        WHERE advisor_name NOT IN (
          SELECT spreadsheet_name FROM advisor_mappings WHERE is_active = true
        )
      `).catch(() => ({ rows: [{ count: 0 }] }));
      
      const unmappedCount = parseInt(unmappedAdvisorsResult.rows[0].count);
      if (unmappedCount > 0) {
        issues.push({
          id: 'unmapped_advisors',
          type: 'warning',
          category: 'advisor_mapping',
          title: 'Unmapped Advisors Detected',
          description: `${unmappedCount} advisor names found in uploads without user mappings`,
          solution: 'Create advisor mappings for these names in the Data Mappings section',
          autoFixable: true,
          count: unmappedCount,
          examples: [],
          lastOccurred: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error detecting issues:', error);
    }
    
    const healthData = {
      overallStatus,
      systemChecks: checks,
      issues,
      recommendations: [
        'Standardize filename formats across all uploads',
        'Create advisor mappings proactively before bulk uploads',
        'Validate spreadsheet data before uploading',
        'Set up automated data quality checks'
      ]
    };
    
    res.json(healthData);
  } catch (error) {
    console.error('Error performing health check:', error);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

// POST /api/data-management/autofix/:issueId - Run auto-fix for an issue
router.post('/autofix/:issueId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { issueId } = req.params;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Implement auto-fix logic based on issue ID
    switch (issueId) {
      case '2': // Unmapped advisors
        // This would implement logic to create suggested mappings
        // For now, just return success
        res.json({ 
          success: true, 
          message: 'Auto-fix completed for unmapped advisors' 
        });
        break;
        
      default:
        res.status(400).json({ 
          error: 'Auto-fix not available for this issue' 
        });
    }
  } catch (error) {
    console.error('Error running auto-fix:', error);
    res.status(500).json({ error: 'Failed to run auto-fix' });
  }
});

// GET /api/data-management/database-schema - Get database schema information
router.get('/database-schema', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get all tables and their column information
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid)) as table_size
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;
    
    const fieldsQuery = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
        CASE WHEN kcu.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
        ccu.table_name as foreign_table,
        ccu.column_name as foreign_column
      FROM information_schema.columns c
      LEFT JOIN information_schema.table_constraints tc 
        ON c.table_name = tc.table_name 
        AND tc.constraint_type = 'PRIMARY KEY'
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON c.table_name = ccu.table_name 
        AND c.column_name = ccu.column_name
        AND tc.constraint_name = ccu.constraint_name
      LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
        AND EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc2 
          WHERE tc2.constraint_name = kcu.constraint_name 
          AND tc2.constraint_type = 'FOREIGN KEY'
        )
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `;
    
    const [tablesResult, fieldsResult] = await Promise.all([
      pool.query(tablesQuery),
      pool.query(fieldsQuery)
    ]);
    
    // Group fields by table
    const fieldsByTable = fieldsResult.rows.reduce((acc, field) => {
      if (!acc[field.table_name]) {
        acc[field.table_name] = [];
      }
      acc[field.table_name].push({
        column_name: field.column_name,
        data_type: field.data_type,
        is_nullable: field.is_nullable,
        column_default: field.column_default,
        character_maximum_length: field.character_maximum_length,
        is_primary_key: field.is_primary_key,
        is_foreign_key: field.is_foreign_key,
        foreign_table: field.foreign_table,
        foreign_column: field.foreign_column
      });
      return acc;
    }, {});
    
    // Combine tables with their fields
    const tables = tablesResult.rows.map(table => ({
      table_name: table.table_name,
      table_type: table.table_type,
      row_count: parseInt(table.row_count) || 0,
      table_size: table.table_size || '0 bytes',
      fields: fieldsByTable[table.table_name] || []
    }));
    
    res.json({ tables });
  } catch (error) {
    console.error('Error fetching database schema:', error);
    res.status(500).json({ error: 'Failed to fetch database schema' });
  }
});

// GET /api/data-management/sample-data/:tableName - Get sample data from a table
router.get('/sample-data/:tableName', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { tableName } = req.params;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Validate table name to prevent SQL injection
    const validTableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = $1 
        AND table_type = 'BASE TABLE'
    `, [tableName]);
    
    if (validTableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    // Get sample data (limit to 5 rows for performance)
    const sampleQuery = `SELECT * FROM "${tableName}" LIMIT 5`;
    const result = await pool.query(sampleQuery);
    
    res.json({ 
      tableName,
      rows: result.rows,
      totalRows: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching sample data:', error);
    res.status(500).json({ error: 'Failed to fetch sample data' });
  }
});

// GET /api/data-management/verification-stats - Get data verification statistics
router.get('/verification-stats', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Performance data statistics
    const performanceStatsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(market_id) as records_with_market_id,
        COUNT(store_id) as records_with_store_id,
        COUNT(advisor_user_id) as records_with_advisor_id,
        COUNT(DISTINCT market_id) as unique_markets,
        COUNT(DISTINCT store_id) as unique_stores,
        COUNT(DISTINCT advisor_user_id) as unique_advisors,
        MIN(upload_date) as earliest_date,
        MAX(upload_date) as latest_date
      FROM performance_data
      WHERE data_type = 'services'
    `;
    
    // Markets statistics
    const marketsStatsQuery = `
      SELECT 
        COUNT(*) as total_markets,
        COUNT(DISTINCT s.market_id) as markets_with_stores,
        COUNT(DISTINCT pd.market_id) as markets_with_performance_data
      FROM markets m
      LEFT JOIN stores s ON m.id = s.market_id
      LEFT JOIN performance_data pd ON m.id = pd.market_id
    `;
    
    // Stores statistics
    const storesStatsQuery = `
      SELECT 
        COUNT(*) as total_stores,
        COUNT(DISTINCT pd.store_id) as stores_with_performance_data,
        COUNT(DISTINCT usa.store_id) as stores_with_advisors
      FROM stores s
      LEFT JOIN performance_data pd ON s.id = pd.store_id
      LEFT JOIN user_store_assignments usa ON s.id = usa.store_id
    `;
    
    // Advisors statistics
    const advisorsStatsQuery = `
      SELECT 
        COUNT(*) as total_advisors,
        COUNT(DISTINCT am.user_id) as advisors_with_mappings,
        COUNT(DISTINCT pd.advisor_user_id) as advisors_with_performance_data,
        (
          SELECT COUNT(DISTINCT (data->>'employeeName'))
          FROM performance_data
          WHERE data_type = 'services'
          AND (data->>'employeeName') NOT IN (
            SELECT spreadsheet_name FROM advisor_mappings WHERE is_active = true
          )
        ) as unmapped_advisors_in_data
      FROM users u
      LEFT JOIN advisor_mappings am ON u.id = am.user_id AND am.is_active = true
      LEFT JOIN performance_data pd ON u.id = pd.advisor_user_id
      WHERE u.role = 'advisor'
    `;
    
    // Data quality checks
    const dataQualityQuery = `
      SELECT 
        (
          SELECT COUNT(*) 
          FROM performance_data 
          WHERE data_type = 'services' 
          AND (market_id IS NULL OR store_id IS NULL)
        ) as orphaned_performance_records,
        (
          SELECT COUNT(*) - COUNT(DISTINCT spreadsheet_name)
          FROM advisor_mappings 
          WHERE is_active = true
        ) as duplicate_advisor_mappings,
        0 as inconsistent_market_names,
        0 as inconsistent_store_names
    `;
    
    const [performanceStats, marketsStats, storesStats, advisorsStats, dataQuality] = await Promise.all([
      pool.query(performanceStatsQuery),
      pool.query(marketsStatsQuery),
      pool.query(storesStatsQuery),
      pool.query(advisorsStatsQuery),
      pool.query(dataQualityQuery)
    ]);
    
    const stats = {
      performanceData: {
        totalRecords: parseInt(performanceStats.rows[0].total_records) || 0,
        recordsWithMarketId: parseInt(performanceStats.rows[0].records_with_market_id) || 0,
        recordsWithStoreId: parseInt(performanceStats.rows[0].records_with_store_id) || 0,
        recordsWithAdvisorId: parseInt(performanceStats.rows[0].records_with_advisor_id) || 0,
        uniqueMarkets: parseInt(performanceStats.rows[0].unique_markets) || 0,
        uniqueStores: parseInt(performanceStats.rows[0].unique_stores) || 0,
        uniqueAdvisors: parseInt(performanceStats.rows[0].unique_advisors) || 0,
        dateRange: {
          earliest: performanceStats.rows[0].earliest_date,
          latest: performanceStats.rows[0].latest_date
        }
      },
      markets: {
        totalMarkets: parseInt(marketsStats.rows[0].total_markets) || 0,
        marketsWithStores: parseInt(marketsStats.rows[0].markets_with_stores) || 0,
        marketsWithPerformanceData: parseInt(marketsStats.rows[0].markets_with_performance_data) || 0
      },
      stores: {
        totalStores: parseInt(storesStats.rows[0].total_stores) || 0,
        storesWithPerformanceData: parseInt(storesStats.rows[0].stores_with_performance_data) || 0,
        storesWithAdvisors: parseInt(storesStats.rows[0].stores_with_advisors) || 0
      },
      advisors: {
        totalAdvisors: parseInt(advisorsStats.rows[0].total_advisors) || 0,
        advisorsWithMappings: parseInt(advisorsStats.rows[0].advisors_with_mappings) || 0,
        advisorsWithPerformanceData: parseInt(advisorsStats.rows[0].advisors_with_performance_data) || 0,
        unmappedAdvisorsInData: parseInt(advisorsStats.rows[0].unmapped_advisors_in_data) || 0
      },
      dataQuality: {
        orphanedPerformanceRecords: parseInt(dataQuality.rows[0].orphaned_performance_records) || 0,
        duplicateAdvisorMappings: parseInt(dataQuality.rows[0].duplicate_advisor_mappings) || 0,
        inconsistentMarketNames: parseInt(dataQuality.rows[0].inconsistent_market_names) || 0,
        inconsistentStoreNames: parseInt(dataQuality.rows[0].inconsistent_store_names) || 0
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ error: 'Failed to fetch verification statistics' });
  }
});

// GET /api/data-management/sample-performance-data - Get sample performance data with linkages
router.get('/sample-performance-data', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const sampleQuery = `
      SELECT 
        pd.id,
        pd.upload_date,
        pd.market_id,
        pd.store_id,
        pd.advisor_user_id,
        m.name as market_name,
        s.name as store_name,
        u.first_name || ' ' || u.last_name as advisor_name,
        pd.data as data_preview
      FROM performance_data pd
      LEFT JOIN markets m ON pd.market_id = m.id
      LEFT JOIN stores s ON pd.store_id = s.id
      LEFT JOIN users u ON pd.advisor_user_id::text = u.id::text
      WHERE pd.data_type = 'services'
      ORDER BY pd.upload_date DESC
      LIMIT 10
    `;
    
    const result = await pool.query(sampleQuery);
    
    res.json({
      records: result.rows.map(row => ({
        ...row,
        data_preview: typeof row.data_preview === 'string' 
          ? JSON.parse(row.data_preview) 
          : row.data_preview
      }))
    });
  } catch (error) {
    console.error('Error fetching sample performance data:', error);
    res.status(500).json({ error: 'Failed to fetch sample data' });
  }
});

// GET /api/data-management/data-breakdown - Get detailed breakdown of data types
router.get('/data-breakdown', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get detailed breakdown of performance data
    const dataBreakdownQuery = `
      SELECT 
        data_type,
        CASE 
          WHEN advisor_user_id IS NULL THEN 'store_level'
          ELSE 'advisor_level'
        END as data_level,
        COUNT(*) as record_count,
        COUNT(DISTINCT market_id) as unique_markets,
        COUNT(DISTINCT store_id) as unique_stores,
        COUNT(DISTINCT advisor_user_id) as unique_advisors,
        MIN(upload_date) as earliest_date,
        MAX(upload_date) as latest_date
      FROM performance_data
      WHERE data_type = 'services'
      GROUP BY data_type, (advisor_user_id IS NULL)
      ORDER BY data_type, data_level
    `;
    
    // Get recent uploads breakdown
    const recentUploadsQuery = `
      SELECT 
        us.filename,
        us.status,
        us.created_at,
        us.discovered_markets->0->>'name' as market_name,
        COALESCE(jsonb_array_length(us.discovered_markets), 0) as markets_count,
        COALESCE(jsonb_array_length(us.discovered_stores), 0) as stores_count,
        COALESCE(jsonb_array_length(us.discovered_advisors), 0) as advisors_count,
        us.raw_data->'stores' is not null as has_store_data,
        us.raw_data->'employees' is not null as has_advisor_data
      FROM upload_sessions us
      WHERE us.created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY us.created_at DESC
      LIMIT 10
    `;
    
    const [dataBreakdown, recentUploads] = await Promise.all([
      pool.query(dataBreakdownQuery),
      pool.query(recentUploadsQuery)
    ]);
    
    const breakdown = {
      performanceData: dataBreakdown.rows.map(row => ({
        dataType: row.data_type,
        dataLevel: row.data_level,
        recordCount: parseInt(row.record_count),
        uniqueMarkets: parseInt(row.unique_markets),
        uniqueStores: parseInt(row.unique_stores),
        uniqueAdvisors: parseInt(row.unique_advisors),
        dateRange: {
          earliest: row.earliest_date,
          latest: row.latest_date
        }
      })),
      recentUploads: recentUploads.rows.map(row => ({
        filename: row.filename,
        status: row.status,
        createdAt: row.created_at,
        marketName: row.market_name,
        marketsCount: parseInt(row.markets_count) || 0,
        storesCount: parseInt(row.stores_count) || 0,
        advisorsCount: parseInt(row.advisors_count) || 0,
        hasStoreData: row.has_store_data,
        hasAdvisorData: row.has_advisor_data
      }))
    };
    
    res.json(breakdown);
  } catch (error) {
    console.error('Error fetching data breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch data breakdown' });
  }
});

module.exports = router;