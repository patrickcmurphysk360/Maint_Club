const express = require('express');
const router = express.Router();

// Get advisor scorecard
router.get('/advisor/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Check permissions - advisors can only see their own scorecard
    if (req.user.role === 'advisor' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own scorecard' });
    }
    
    // Get performance data for this advisor
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data
      FROM performance_data pd
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date BETWEEN $2 AND $3
      ORDER BY pd.upload_date DESC
    `, [userId, startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]]);
    
    // Get vendor mappings for the user's stores/markets
    const vendorMappingsResult = await pool.query(`
      SELECT DISTINCT
        vpm.vendor_id,
        vpm.service_field,
        vpm.product_name,
        vt.name as vendor_name
      FROM advisor_mappings am
      JOIN market_tags mt ON mt.market_id = am.market_id
      JOIN vendor_product_mappings vpm ON vpm.vendor_id = mt.tag_id
      JOIN vendor_tags vt ON vt.id = vpm.vendor_id
      WHERE am.user_id = $1 AND am.is_active = true
    `, [userId]);
    
    // Build vendor mapping lookup
    const vendorMappings = {};
    vendorMappingsResult.rows.forEach(row => {
      if (!vendorMappings[row.service_field]) {
        vendorMappings[row.service_field] = {};
      }
      vendorMappings[row.service_field][row.vendor_id] = {
        productName: row.product_name,
        vendorName: row.vendor_name
      };
    });
    
    // Calculate aggregated metrics
    const metrics = {
      invoices: 0,
      sales: 0,
      gpSales: 0,
      services: {}
    };
    
    // Service fields to track
    const serviceFields = [
      'premiumOilChange', 'fuelAdditive', 'engineFlush', 'filters',
      'oilChange', 'alignments', 'brakeService', 'brakeFlush',
      'engineAirFilter', 'cabinAirFilter', 'coolantFlush',
      'differentialService', 'fuelSystemService', 'powerSteeringFlush',
      'transmissionFluidService', 'battery', 'allTires'
    ];
    
    // Initialize service counters
    serviceFields.forEach(field => {
      metrics.services[field] = 0;
    });
    
    // Aggregate data
    performanceResult.rows.forEach(row => {
      const data = row.data;
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      serviceFields.forEach(field => {
        metrics.services[field] += parseInt(data[field] || 0);
      });
    });
    
    // Calculate GP%
    metrics.gpPercent = metrics.sales > 0 ? (metrics.gpSales / metrics.sales) * 100 : 0;
    
    // Apply vendor mappings to service names
    const mappedServices = {};
    Object.entries(metrics.services).forEach(([field, count]) => {
      const fieldMapping = {
        'premiumOilChange': 'Premium Oil Change',
        'fuelAdditive': 'Fuel Additive',
        'engineFlush': 'Engine Flush',
        'filters': 'Filters',
        'oilChange': 'Oil Change',
        'alignments': 'Alignments',
        'brakeService': 'Brake Service',
        'brakeFlush': 'Brake Flush',
        'engineAirFilter': 'Engine Air Filter',
        'cabinAirFilter': 'Cabin Air Filter',
        'coolantFlush': 'Coolant Flush',
        'differentialService': 'Differential Service',
        'fuelSystemService': 'Fuel System Service',
        'powerSteeringFlush': 'Power Steering Flush',
        'transmissionFluidService': 'Transmission Fluid Service',
        'battery': 'Battery',
        'allTires': 'All Tires'
      };
      
      const serviceName = fieldMapping[field] || field;
      let displayName = serviceName;
      
      // Check if there's a vendor mapping for this service
      if (vendorMappings[serviceName]) {
        // Get the first vendor mapping
        const vendorMapping = Object.values(vendorMappings[serviceName])[0];
        if (vendorMapping) {
          displayName = `${vendorMapping.productName}`;
        }
      }
      
      if (count > 0) {
        mappedServices[displayName] = count;
      }
    });
    
    // Get goals for this advisor
    const goalsResult = await pool.query(`
      SELECT 
        metric_name,
        target_value,
        period_type,
        effective_date
      FROM goals
      WHERE goal_type = 'advisor'
        AND advisor_user_id = $1
        AND effective_date <= CURRENT_DATE
      ORDER BY effective_date DESC
    `, [userId]);
    
    // Build goals object
    const goals = {};
    goalsResult.rows.forEach(row => {
      if (!goals[row.metric_name]) {
        goals[row.metric_name] = {
          target: parseFloat(row.target_value),
          periodType: row.period_type,
          effectiveDate: row.effective_date
        };
      }
    });
    
    // Build scorecard response
    const scorecard = {
      userId: parseInt(userId),
      period: {
        startDate: startDate || '2024-01-01',
        endDate: endDate || new Date().toISOString().split('T')[0]
      },
      metrics: {
        invoices: metrics.invoices,
        sales: metrics.sales,
        gpSales: metrics.gpSales,
        gpPercent: metrics.gpPercent.toFixed(1)
      },
      services: mappedServices,
      goals: goals,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(scorecard);
    
  } catch (error) {
    console.error('Error getting advisor scorecard:', error);
    res.status(500).json({ message: 'Failed to get advisor scorecard' });
  }
});

// Get scorecard comparison (for managers)
router.get('/comparison', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId, marketId, startDate, endDate } = req.query;
    
    // Check permissions
    if (req.user.role === 'advisor') {
      return res.status(403).json({ message: 'Forbidden: Advisors cannot view comparisons' });
    }
    
    let whereClause = '';
    const params = [startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]];
    
    if (storeId) {
      whereClause = 'AND am.store_id = $3';
      params.push(storeId);
    } else if (marketId) {
      whereClause = 'AND am.market_id = $3';
      params.push(marketId);
    }
    
    // Get advisor performance comparison
    const result = await pool.query(`
      SELECT 
        u.id as advisor_id,
        u.first_name || ' ' || u.last_name as advisor_name,
        s.name as store_name,
        m.name as market_name,
        COALESCE(SUM((pd.data->>'invoices')::int), 0) as total_invoices,
        COALESCE(SUM((pd.data->>'sales')::numeric), 0) as total_sales,
        COALESCE(SUM((pd.data->>'gpSales')::numeric), 0) as total_gp_sales,
        CASE 
          WHEN SUM((pd.data->>'sales')::numeric) > 0 
          THEN (SUM((pd.data->>'gpSales')::numeric) / SUM((pd.data->>'sales')::numeric)) * 100
          ELSE 0 
        END as gp_percent,
        CASE 
          WHEN SUM((pd.data->>'invoices')::int) > 0 
          THEN SUM((pd.data->>'sales')::numeric) / SUM((pd.data->>'invoices')::int)
          ELSE 0 
        END as avg_ro
      FROM users u
      JOIN advisor_mappings am ON am.user_id = u.id
      LEFT JOIN stores s ON am.store_id = s.id
      LEFT JOIN markets m ON am.market_id = m.id
      LEFT JOIN performance_data pd ON pd.advisor_user_id = u.id
        AND pd.data_type = 'services'
        AND pd.upload_date BETWEEN $1 AND $2
      WHERE u.role = 'advisor' 
        AND u.status = 'active'
        AND am.is_active = true
        ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, s.name, m.name
      ORDER BY total_sales DESC
    `, params);
    
    res.json({
      period: {
        startDate: params[0],
        endDate: params[1]
      },
      advisors: result.rows
    });
    
  } catch (error) {
    console.error('Error getting scorecard comparison:', error);
    res.status(500).json({ message: 'Failed to get scorecard comparison' });
  }
});

module.exports = router;