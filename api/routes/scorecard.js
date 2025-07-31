const express = require('express');
const router = express.Router();

// Get advisor scorecard
router.get('/advisor/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Debug logging temporarily disabled
    // console.log('🔍 SCORECARD DEBUG: Getting scorecard for user', userId, 'from', startDate, 'to', endDate);
    
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
    
    // Debug logging reduced to essential info only
    console.log(`📊 Scorecard for user ${userId}: Found ${performanceResult.rows.length} performance records`);
    
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
    console.log(`📦 User ${userId} vendor mappings:`, vendorMappingsResult.rows.map(r => `${r.service_field} -> ${r.product_name}`));
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
    
    // Initialize aggregated data container
    const aggregatedData = {};
    const aggregatedOtherServices = {};
    
    // Aggregate data from all performance records
    performanceResult.rows.forEach((row, index) => {
      const data = row.data;
      
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      // Aggregate all numeric fields from main data
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
          aggregatedData[key] = (aggregatedData[key] || 0) + data[key];
        }
      });
      
      // Aggregate otherServices nested data
      if (data.otherServices) {
        Object.keys(data.otherServices).forEach(key => {
          const value = parseFloat(data.otherServices[key]);
          if (!isNaN(value)) {
            aggregatedOtherServices[key] = (aggregatedOtherServices[key] || 0) + value;
          }
        });
      }
    });
    
    console.log(`📊 User ${userId} totals: ${metrics.invoices} invoices, $${metrics.sales} sales, ${Object.keys(aggregatedData).length + Object.keys(aggregatedOtherServices).length} service types`);
    
    // Calculate GP%
    metrics.gpPercent = metrics.sales > 0 ? (metrics.gpSales / metrics.sales) * 100 : 0;
    
    // Create smart field mapping that handles template field keys
    const mappedServices = {};
    
    // Template field key to data mapping
    const templateFieldMappings = {
      // Direct field mappings (camelCase in data)
      'premiumoilchange': { type: 'direct', field: 'premiumOilChange', label: 'Premium Oil Change' },
      'oilchange': { type: 'direct', field: 'oilChange', label: 'Oil Change' },
      'alignments': { type: 'direct', field: 'alignments', label: 'Alignments' },
      'brakeservice': { type: 'direct', field: 'brakeService', label: 'Brake Service' },
      'brakeflush': { type: 'direct', field: 'brakeFlush', label: 'Brake Flush' },
      'engineairfilter': { type: 'direct', field: 'engineAirFilter', label: 'Engine Air Filter' },
      'cabinairfilter': { type: 'direct', field: 'cabinAirFilter', label: 'Cabin Air Filter' },
      'coolantflush': { type: 'direct', field: 'coolantFlush', label: 'Coolant Flush' },
      'differentialservice': { type: 'direct', field: 'differentialService', label: 'Differential Service' },
      'fuelsystemservice': { type: 'direct', field: 'fuelSystemService', label: 'Fuel System Service' },
      'powersteeringflush': { type: 'direct', field: 'powerSteeringFlush', label: 'Power Steering Flush' },
      'transmissionfluidservice': { type: 'direct', field: 'transmissionFluidService', label: 'Transmission Fluid Service' },
      'fueladditive': { type: 'direct', field: 'fuelAdditive', label: 'Fuel Additive' },
      'battery': { type: 'direct', field: 'battery', label: 'Battery' },
      'alltires': { type: 'direct', field: 'allTires', label: 'All Tires' },
      'retailtires': { type: 'direct', field: 'retailTires', label: 'Retail Tires' },
      'tireprotection': { type: 'direct', field: 'tireProtection', label: 'Tire Protection' },
      'acservice': { type: 'direct', field: 'acService', label: 'AC Service' },
      'wiperblades': { type: 'direct', field: 'wiperBlades', label: 'Wiper Blades' },
      'shocksstruts': { type: 'direct', field: 'shocksStruts', label: 'Shocks & Struts' },
      
      // otherServices nested mappings
      'tirebalance': { type: 'nested', field: 'Tire Balance', label: 'Tire Balance' },
      'tirerotation': { type: 'nested', field: 'Tire Rotation', label: 'Tire Rotation' },
      'batteryservice': { type: 'nested', field: 'Battery Service', label: 'Battery Service' },
      'engineperformanceservice': { type: 'nested', field: 'Engine Performance Service', label: 'Engine Performance Service' },
      'sparkplugreplacement': { type: 'nested', field: 'Spark Plug Replacement', label: 'Spark Plug Replacement' },
      'completevehicleinspection': { type: 'nested', field: 'Complete Vehicle Inspection', label: 'Complete Vehicle Inspection' },
      'beltsreplacement': { type: 'nested', field: 'Belts Replacement', label: 'Belts Replacement' },
      'hosereplacement': { type: 'nested', field: 'Hose Replacement', label: 'Hose Replacement' },
      'climatecontrolservice': { type: 'nested', field: 'Climate Control Service', label: 'Climate Control Service' },
      'tpms': { type: 'nested', field: 'TPMS', label: 'TPMS' },
      'nitrogen': { type: 'nested', field: 'Nitrogen', label: 'Nitrogen' },
      'timingbelt': { type: 'nested', field: 'Timing Belt', label: 'Timing Belt' },
      'transfercaseservice': { type: 'nested', field: 'Transfer Case Service', label: 'Transfer Case Service' },
      'headlightrestorationservice': { type: 'nested', field: 'Headlight Restoration Service', label: 'Headlight Restoration Service' }
    };
    
    // Process all template field mappings - include ALL services, even with zero values
    Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
      let value = 0;
      
      if (mapping.type === 'direct') {
        value = aggregatedData[mapping.field] || 0;
      } else if (mapping.type === 'nested') {
        value = aggregatedOtherServices[mapping.field] || 0;
      }
      
      let displayName = mapping.label;
      
      // Check if there's a vendor mapping for this service
      // Apply vendor mappings even for zero values so branded names appear
      let vendorMapping = null;
      
      // 1. Try exact template key match (e.g., "premiumoilchange")
      if (vendorMappings[templateKey]) {
        vendorMapping = Object.values(vendorMappings[templateKey])[0];
        console.log(`🎯 Template key match: ${templateKey} -> ${vendorMapping.productName}`);
      }
      
      // 2. Try exact label match (e.g., "Premium Oil Change")
      if (!vendorMapping && vendorMappings[mapping.label]) {
        vendorMapping = Object.values(vendorMappings[mapping.label])[0];
        console.log(`🎯 Label match: ${mapping.label} -> ${vendorMapping.productName}`);
      }
      
      // 3. Try camelCase field name match (e.g., "premiumOilChange")
      if (!vendorMapping && mapping.type === 'direct' && vendorMappings[mapping.field]) {
        vendorMapping = Object.values(vendorMappings[mapping.field])[0];
        console.log(`🎯 Field match: ${mapping.field} -> ${vendorMapping.productName}`);
      }
      
      // 4. Try case-insensitive matching for template key vs vendor mapping keys
      if (!vendorMapping) {
        const matchingKey = Object.keys(vendorMappings).find(key => 
          key.toLowerCase() === templateKey.toLowerCase()
        );
        if (matchingKey) {
          vendorMapping = Object.values(vendorMappings[matchingKey])[0];
          console.log(`🎯 Case-insensitive match: ${templateKey} -> ${matchingKey} -> ${vendorMapping.productName}`);
        }
      }
      
      if (vendorMapping) {
        displayName = vendorMapping.productName;
      } else if (templateKey === 'engineperformanceservice' || templateKey === 'premiumoilchange') {
        console.log(`❌ No vendor mapping found for ${templateKey}. Available mappings:`, Object.keys(vendorMappings));
      }
      
      // Include ALL services in response, even zeros - frontend template decides what to show
      mappedServices[displayName] = value;
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