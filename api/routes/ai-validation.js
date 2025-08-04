const express = require('express');
const ScorecardFieldValidator = require('../services/scorecardFieldValidator');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All validation endpoints require authentication
router.use(authenticateToken);

/**
 * Get validation statistics
 * Only admins can access validation stats
 */
router.get('/stats', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const validator = new ScorecardFieldValidator(pool);
    
    const days = parseInt(req.query.days) || 7;
    const stats = await validator.getValidationStats(days);
    
    res.json({
      success: true,
      data: stats,
      period_days: days,
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
 * Get recent violations
 * Admins can see all violations, other users only their own
 */
router.get('/violations', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const limit = parseInt(req.query.limit) || 50;
    const days = parseInt(req.query.days) || 7;
    
    let whereClause = 'WHERE created_at >= NOW() - INTERVAL $1';
    let params = [`${days} days`];
    
    // Non-admin users can only see their own violations
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      whereClause += ' AND user_id = $2';
      params.push(req.user.id);
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        query,
        violations,
        response_excerpt,
        severity,
        created_at,
        (SELECT first_name || ' ' || last_name FROM users WHERE id = av.user_id) as user_name
      FROM ai_scorecard_violations av
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      period_days: days,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting violations:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving violations',
      error: error.message
    });
  }
});

/**
 * Get top violated fields
 * Admin only endpoint
 */
router.get('/violated-fields', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const days = parseInt(req.query.days) || 7;
    
    const result = await pool.query('SELECT * FROM get_top_violated_fields($1)', [days]);
    
    res.json({
      success: true,
      data: result.rows,
      period_days: days,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting violated fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving violated fields',
      error: error.message
    });
  }
});

/**
 * Get approved field whitelist
 * Available to all authenticated users for reference
 */
router.get('/approved-fields', async (req, res) => {
  try {
    const validator = new ScorecardFieldValidator();
    
    res.json({
      success: true,
      data: {
        approved_fields: validator.approvedFields,
        forbidden_fields: validator.forbiddenFields,
        field_count: Object.keys(validator.approvedFields).length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting approved fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving approved fields',
      error: error.message
    });
  }
});

/**
 * Test validation on a sample response
 * Admin only - for testing purposes
 */
router.post('/test', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const { response_text, test_query, test_user_id } = req.body;
    
    if (!response_text || !test_query) {
      return res.status(400).json({
        success: false,
        message: 'response_text and test_query are required'
      });
    }
    
    const pool = req.app.locals.pool;
    const validator = new ScorecardFieldValidator(pool);
    
    const validation = await validator.validateResponse(
      response_text,
      test_user_id || req.user.id,
      test_query,
      { performance: { is_performance_query: true } }
    );
    
    res.json({
      success: true,
      validation: validation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing validation:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing validation',
      error: error.message
    });
  }
});

/**
 * Get validation dashboard data
 * Admin only - comprehensive validation overview
 */
router.get('/dashboard', requireRole(['admin', 'administrator']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const validator = new ScorecardFieldValidator(pool);
    
    const days = parseInt(req.query.days) || 7;
    
    // Get multiple data sources in parallel
    const [stats, violatedFields, recentViolations] = await Promise.all([
      validator.getValidationStats(days),
      pool.query('SELECT * FROM get_top_violated_fields($1) LIMIT 10', [days]),
      pool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as violation_count,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(json_array_length(violations)) as avg_violations_per_response
        FROM ai_scorecard_violations
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `)
    ]);
    
    res.json({
      success: true,
      data: {
        overview: stats,
        violated_fields: violatedFields.rows,
        daily_trends: recentViolations.rows,
        approved_field_count: Object.keys(validator.approvedFields).length,
        forbidden_field_count: validator.forbiddenFields.length
      },
      period_days: days,
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

module.exports = router;