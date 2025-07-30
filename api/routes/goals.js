const express = require('express');
const router = express.Router();

// Get available metrics for goals based on spreadsheet data
router.get('/available-metrics', async (req, res) => {
  try {
    // These are the metrics available from the spreadsheet data
    const metrics = {
      financial: [
        { name: 'Sales', key: 'sales', format: 'currency' },
        { name: 'GP Sales', key: 'gpSales', format: 'currency' },
        { name: 'GP %', key: 'gpPercent', format: 'percentage' },
        { name: 'Invoices', key: 'invoices', format: 'number' },
        { name: 'Average RO', key: 'averageRO', format: 'currency' }
      ],
      services: [
        { name: 'Premium Oil Change', key: 'premiumOilChange', format: 'number' },
        { name: 'Fuel Additive', key: 'fuelAdditive', format: 'number' },
        { name: 'Engine Flush', key: 'engineFlush', format: 'number' },
        { name: 'Oil Change', key: 'oilChange', format: 'number' },
        { name: 'Alignments', key: 'alignments', format: 'number' },
        { name: 'Brake Service', key: 'brakeService', format: 'number' },
        { name: 'Brake Flush', key: 'brakeFlush', format: 'number' },
        { name: 'Engine Air Filter', key: 'engineAirFilter', format: 'number' },
        { name: 'Cabin Air Filter', key: 'cabinAirFilter', format: 'number' },
        { name: 'Filters', key: 'filters', format: 'number' }
      ],
      operations: [
        { name: 'Labor Hours', key: 'laborHours', format: 'number' },
        { name: 'Effective Labor Rate', key: 'effectiveLaborRate', format: 'currency' },
        { name: 'Tire Units', key: 'tireUnits', format: 'number' },
        { name: 'Parts GP %', key: 'partsGpPercent', format: 'percentage' }
      ]
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching available metrics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get goals by type and entity
router.get('/:goalType/:entityId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { goalType, entityId } = req.params;
    const { effectiveDate } = req.query;
    
    // Validate goal type
    if (!['market', 'store', 'advisor'].includes(goalType)) {
      return res.status(400).json({ message: 'Invalid goal type' });
    }
    
    // Build query based on goal type
    let whereClause = 'goal_type = $1';
    const params = [goalType];
    
    switch (goalType) {
      case 'market':
        whereClause += ' AND market_id = $2';
        params.push(entityId);
        break;
      case 'store':
        whereClause += ' AND store_id = $2';
        params.push(entityId);
        break;
      case 'advisor':
        whereClause += ' AND advisor_user_id = $2';
        params.push(entityId);
        break;
    }
    
    if (effectiveDate) {
      whereClause += ' AND effective_date <= $3';
      params.push(effectiveDate);
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        goal_type as "goalType",
        market_id as "marketId",
        store_id as "storeId",
        advisor_user_id as "advisorUserId",
        metric_name as "metricName",
        target_value as "targetValue",
        period_type as "periodType",
        effective_date as "effectiveDate",
        created_by as "createdBy",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM goals
      WHERE ${whereClause}
      ORDER BY effective_date DESC, metric_name
    `, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or update goals
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { goalType, entityId, goals, effectiveDate, periodType = 'monthly' } = req.body;
    const userId = req.user.id;
    
    // Check permissions based on role and goal type
    const canSetGoals = await checkGoalPermissions(req.user, goalType, entityId, pool);
    if (!canSetGoals) {
      return res.status(403).json({ message: 'You do not have permission to set goals for this entity' });
    }
    
    // Validate input
    if (!goalType || !entityId || !goals || !effectiveDate) {
      return res.status(400).json({ message: 'Goal type, entity ID, goals, and effective date are required' });
    }
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Prepare values for insert/update
      const results = [];
      
      for (const [metricName, targetValue] of Object.entries(goals)) {
        let query;
        let params;
        
        switch (goalType) {
          case 'market':
            query = `
              INSERT INTO goals (goal_type, market_id, metric_name, target_value, period_type, effective_date, created_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (goal_type, market_id, store_id, advisor_user_id, metric_name, effective_date)
              DO UPDATE SET 
                target_value = $4,
                period_type = $5,
                updated_at = CURRENT_TIMESTAMP
              RETURNING *
            `;
            params = [goalType, entityId, metricName, targetValue, periodType, effectiveDate, userId];
            break;
            
          case 'store':
            query = `
              INSERT INTO goals (goal_type, store_id, metric_name, target_value, period_type, effective_date, created_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (goal_type, market_id, store_id, advisor_user_id, metric_name, effective_date)
              DO UPDATE SET 
                target_value = $4,
                period_type = $5,
                updated_at = CURRENT_TIMESTAMP
              RETURNING *
            `;
            params = [goalType, entityId, metricName, targetValue, periodType, effectiveDate, userId];
            break;
            
          case 'advisor':
            query = `
              INSERT INTO goals (goal_type, advisor_user_id, metric_name, target_value, period_type, effective_date, created_by)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (goal_type, market_id, store_id, advisor_user_id, metric_name, effective_date)
              DO UPDATE SET 
                target_value = $4,
                period_type = $5,
                updated_at = CURRENT_TIMESTAMP
              RETURNING *
            `;
            params = [goalType, entityId, metricName, targetValue, periodType, effectiveDate, userId];
            break;
        }
        
        const result = await client.query(query, params);
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Goals saved successfully',
        count: results.length,
        goals: results
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error saving goals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to check goal permissions
async function checkGoalPermissions(user, goalType, entityId, pool) {
  switch (user.role) {
    case 'admin':
      return true;
      
    case 'marketManager':
      if (goalType === 'market') {
        // Check if user manages this market
        const result = await pool.query(
          'SELECT 1 FROM user_markets WHERE user_id = $1 AND market_id = $2',
          [user.id, entityId]
        );
        return result.rows.length > 0;
      }
      return false;
      
    case 'storeManager':
      if (goalType === 'store') {
        // Check if user manages this store
        const result = await pool.query(
          'SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = $2',
          [user.id, entityId]
        );
        return result.rows.length > 0;
      } else if (goalType === 'advisor') {
        // Store managers can set goals for advisors in their store
        const result = await pool.query(`
          SELECT 1 
          FROM advisor_mappings am
          JOIN user_stores us ON us.store_id = am.store_id
          WHERE us.user_id = $1 AND am.user_id = $2
        `, [user.id, entityId]);
        return result.rows.length > 0;
      }
      return false;
      
    default:
      return false;
  }
}

module.exports = router;