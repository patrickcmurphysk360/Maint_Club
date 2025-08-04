/**
 * AI Validation Dashboard API
 * 
 * Provides endpoints for monitoring AI response validation results,
 * mismatch detection, and audit trail access for administrators.
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const AIValidationMiddleware = require('../middleware/aiValidationMiddleware');

const router = express.Router();

// All validation dashboard endpoints require authentication
router.use(authenticateToken);

/**
 * Get validation statistics overview
 * Admin only endpoint for monitoring validation performance
 */
router.get('/stats', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const days = parseInt(req.query.days) || 7;
    
    console.log(`📊 Getting AI validation stats for last ${days} days`);
    
    const result = await pool.query('SELECT * FROM get_ai_validation_stats($1)', [days]);
    const stats = result.rows[0] || {};
    
    // Calculate additional metrics
    const passRate = stats.total_validations > 0 
      ? ((stats.passed_validations / stats.total_validations) * 100).toFixed(1)
      : '0.0';
    
    const failRate = stats.total_validations > 0
      ? ((stats.failed_validations / stats.total_validations) * 100).toFixed(1)
      : '0.0';

    res.json({
      success: true,
      period_days: days,
      summary: {
        total_validations: parseInt(stats.total_validations) || 0,
        passed_validations: parseInt(stats.passed_validations) || 0,
        failed_validations: parseInt(stats.failed_validations) || 0,
        pass_rate_percent: parseFloat(passRate),
        fail_rate_percent: parseFloat(failRate),
        avg_confidence_score: parseFloat(stats.avg_confidence_score) || 1.0,
        avg_mismatch_count: parseFloat(stats.avg_mismatch_count) || 0.0,
        unique_users: parseInt(stats.unique_users) || 0
      },
      top_mismatched_metrics: stats.top_mismatched_metrics || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting validation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving validation statistics',
      error: error.message
    });
  }
});

/**
 * Get validation trends over time
 * Shows daily breakdown of validation results
 */
router.get('/trends', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const days = parseInt(req.query.days) || 30;
    
    console.log(`📈 Getting AI validation trends for last ${days} days`);
    
    const result = await pool.query('SELECT * FROM get_ai_mismatch_trends($1)', [days]);
    
    res.json({
      success: true,
      period_days: days,
      trends: result.rows.map(row => ({
        date: row.date,
        total_validations: parseInt(row.total_validations),
        failed_validations: parseInt(row.failed_validations),
        pass_rate_percent: row.total_validations > 0 
          ? (((row.total_validations - row.failed_validations) / row.total_validations) * 100).toFixed(1)
          : '100.0',
        avg_confidence: parseFloat(row.avg_confidence) || 1.0,
        most_common_mismatch: row.most_common_mismatch
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting validation trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving validation trends',
      error: error.message
    });
  }
});

/**
 * Get recent validation failures
 * Shows detailed information about failed validations
 */
router.get('/failures', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const limit = parseInt(req.query.limit) || 50;
    const days = parseInt(req.query.days) || 7;
    
    console.log(`🚨 Getting recent validation failures (last ${days} days, limit ${limit})`);
    
    const result = await pool.query(`
      SELECT 
        al.id,
        al.user_id,
        al.query,
        al.is_valid,
        al.mismatch_count,
        al.confidence_score,
        al.disclaimer,
        al.created_at,
        u.first_name || ' ' || u.last_name as user_name,
        u.role as user_role,
        json_agg(
          DISTINCT jsonb_build_object(
            'metric', mm.metric_name,
            'expected', mm.expected_value,
            'detected', mm.detected_value,
            'severity', mm.severity,
            'type', mm.metric_type
          )
        ) FILTER (WHERE mm.id IS NOT NULL) as mismatches
      FROM ai_validation_audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN ai_metric_mismatches mm ON al.id = mm.audit_log_id
      WHERE al.is_valid = false 
        AND al.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY al.id, al.user_id, al.query, al.is_valid, al.mismatch_count, 
               al.confidence_score, al.disclaimer, al.created_at, u.first_name, u.last_name, u.role
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `);
    
    res.json({
      success: true,
      period_days: days,
      limit: limit,
      failures: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting validation failures:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving validation failures',
      error: error.message
    });
  }
});

/**
 * Get validation dashboard summary
 * Comprehensive overview for admin dashboard
 */
router.get('/dashboard', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const days = parseInt(req.query.days) || 7;
    
    console.log(`📋 Getting validation dashboard data for last ${days} days`);
    
    // Get multiple data sources in parallel
    const [statsResult, trendsResult, dashboardView] = await Promise.all([
      pool.query('SELECT * FROM get_ai_validation_stats($1)', [days]),
      pool.query('SELECT * FROM get_ai_mismatch_trends($1) LIMIT 7', [days]),
      pool.query(`
        SELECT * FROM ai_validation_dashboard 
        WHERE validation_date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY validation_date DESC
      `)
    ]);
    
    const stats = statsResult.rows[0] || {};
    const recentTrends = trendsResult.rows || [];
    const dailySummary = dashboardView.rows || [];
    
    // Calculate health score based on multiple factors
    const totalValidations = parseInt(stats.total_validations) || 0;
    const passRate = totalValidations > 0 
      ? (parseInt(stats.passed_validations) / totalValidations) * 100 
      : 100;
    const avgConfidence = parseFloat(stats.avg_confidence_score) || 1.0;
    const avgMismatches = parseFloat(stats.avg_mismatch_count) || 0.0;
    
    const healthScore = Math.round(
      (passRate * 0.4) + 
      (avgConfidence * 100 * 0.4) + 
      (Math.max(0, 100 - (avgMismatches * 10)) * 0.2)
    );
    
    let healthStatus = 'excellent';
    if (healthScore < 95) healthStatus = 'good';
    if (healthScore < 85) healthStatus = 'fair';
    if (healthScore < 75) healthStatus = 'poor';
    
    res.json({
      success: true,
      period_days: days,
      health: {
        score: healthScore,
        status: healthStatus,
        pass_rate: passRate.toFixed(1),
        avg_confidence: avgConfidence,
        avg_mismatches: avgMismatches
      },
      overview: {
        total_validations: totalValidations,
        passed_validations: parseInt(stats.passed_validations) || 0,
        failed_validations: parseInt(stats.failed_validations) || 0,
        unique_users: parseInt(stats.unique_users) || 0,
        top_mismatched_metrics: stats.top_mismatched_metrics || []
      },
      recent_trends: recentTrends,
      daily_summary: dailySummary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting validation dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving validation dashboard',
      error: error.message
    });
  }
});

/**
 * Get validation details for specific user
 * Shows validation history for a particular user
 */
router.get('/user/:userId', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`👤 Getting validation history for user ${userId} (last ${days} days)`);
    
    const result = await pool.query(`
      SELECT 
        al.id,
        al.query,
        al.is_valid,
        al.mismatch_count,
        al.confidence_score,
        al.disclaimer,
        al.expected_values,
        al.detected_values,
        al.created_at,
        json_agg(
          DISTINCT jsonb_build_object(
            'metric', mm.metric_name,
            'expected', mm.expected_value,
            'detected', mm.detected_value,
            'severity', mm.severity,
            'type', mm.metric_type
          )
        ) FILTER (WHERE mm.id IS NOT NULL) as mismatches
      FROM ai_validation_audit_log al
      LEFT JOIN ai_metric_mismatches mm ON al.id = mm.audit_log_id
      WHERE al.user_id = $1 
        AND al.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY al.id, al.query, al.is_valid, al.mismatch_count, 
               al.confidence_score, al.disclaimer, al.expected_values, 
               al.detected_values, al.created_at
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `, [userId]);
    
    // Get user info
    const userResult = await pool.query(`
      SELECT id, first_name, last_name, email, role
      FROM users WHERE id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const userData = userResult.rows[0];
    
    // Calculate user-specific stats
    const totalQueries = result.rows.length;
    const failedQueries = result.rows.filter(r => !r.is_valid).length;
    const avgConfidence = totalQueries > 0 
      ? result.rows.reduce((sum, r) => sum + parseFloat(r.confidence_score), 0) / totalQueries
      : 1.0;
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        name: `${userData.first_name} ${userData.last_name}`,
        email: userData.email,
        role: userData.role
      },
      period_days: days,
      stats: {
        total_queries: totalQueries,
        passed_queries: totalQueries - failedQueries,
        failed_queries: failedQueries,
        pass_rate_percent: totalQueries > 0 ? (((totalQueries - failedQueries) / totalQueries) * 100).toFixed(1) : '100.0',
        avg_confidence_score: avgConfidence.toFixed(2)
      },
      validation_history: result.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting user validation history:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user validation history',
      error: error.message
    });
  }
});

/**
 * Test validation system
 * Admin endpoint to test the validation middleware
 */
router.post('/test', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { query, response_text, test_user_id } = req.body;
    
    if (!query || !response_text) {
      return res.status(400).json({
        success: false,
        message: 'query and response_text are required'
      });
    }
    
    const userId = test_user_id || req.user.id;
    
    console.log(`🧪 Testing validation system for user ${userId}`);
    
    const validationMiddleware = new AIValidationMiddleware(pool);
    
    const validationResult = await validationMiddleware.validateAIResponse(
      query,
      response_text,
      userId,
      { performance: { is_performance_query: true } }
    );
    
    res.json({
      success: true,
      test_query: query,
      test_response: response_text,
      validation_result: validationResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing validation system:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing validation system',
      error: error.message
    });
  }
});

module.exports = router;