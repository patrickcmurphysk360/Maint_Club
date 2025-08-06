const express = require('express');
const router = express.Router();

// Get advisor scorecard
router.get('/advisor/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const { startDate, endDate, mtdMonth, mtdYear } = req.query;
    
    // Debug logging temporarily disabled
    // console.log('🔍 SCORECARD DEBUG: Getting scorecard for user', userId, 'from', startDate, 'to', endDate);
    
    // Check permissions - advisors can only see their own scorecard
    if (req.user.role === 'advisor' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own scorecard' });
    }
    
    // Get the LATEST performance data for specific MTD month or date range
    let performanceResult;
    
    if (mtdMonth && mtdYear) {
      // MTD-specific query: get LATEST record per store for the specified month
      console.log(`📊 Getting MTD data for ${mtdYear}-${mtdMonth.padStart(2, '0')} for user ${userId} (latest per store only)`);
      
      performanceResult = await pool.query(`
        WITH latest_per_store AS (
          SELECT 
            pd.upload_date,
            pd.data,
            pd.store_id,
            s.name as store_name,
            ROW_NUMBER() OVER (
              PARTITION BY pd.store_id 
              ORDER BY pd.upload_date DESC
            ) as rn
          FROM performance_data pd
          LEFT JOIN stores s ON pd.store_id::text = s.id::text
          WHERE pd.advisor_user_id = $1
            AND pd.data_type = 'services'
            AND EXTRACT(YEAR FROM pd.upload_date) = $2
            AND EXTRACT(MONTH FROM pd.upload_date) = $3
        )
        SELECT 
          upload_date,
          data,
          store_id,
          store_name
        FROM latest_per_store 
        WHERE rn = 1
        ORDER BY store_name
      `, [userId, parseInt(mtdYear), parseInt(mtdMonth)]);
    } else {
      // Date range query (backward compatibility)
      performanceResult = await pool.query(`
        WITH latest_per_month AS (
          SELECT 
            pd.upload_date,
            pd.data,
            ROW_NUMBER() OVER (
              PARTITION BY EXTRACT(YEAR FROM pd.upload_date), EXTRACT(MONTH FROM pd.upload_date) 
              ORDER BY pd.upload_date DESC
            ) as rn
          FROM performance_data pd
          WHERE pd.advisor_user_id = $1
            AND pd.data_type = 'services'
            AND pd.upload_date BETWEEN $2 AND $3
        )
        SELECT upload_date, data
        FROM latest_per_month 
        WHERE rn = 1
        ORDER BY upload_date DESC
      `, [userId, startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]]);
    }
    
    // Debug logging for multi-store aggregation
    console.log(`📊 Scorecard for user ${userId}: Found ${performanceResult.rows.length} performance records`);
    if (performanceResult.rows.length > 1) {
      console.log(`🏪 Multi-store advisor detected. Stores: ${performanceResult.rows.map(r => r.store_name || r.store_id).join(', ')}`);
    }
    
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
    
    // Clear any percentage fields that might interfere with recalculation
    const percentageFields = ['brakeFlushToServicePercent', 'potentialAlignmentsPercent', 'tireProtectionPercent'];
    percentageFields.forEach(field => {
      aggregatedData[field] = undefined;
    });
    
    // Aggregate data from latest performance record per store (MTD snapshots)
    console.log(`[DEBUG] performanceResult.rows.length: ${performanceResult.rows.length}`);
    if (performanceResult.rows.length > 0) {
      console.log(`[DEBUG] First row:`, JSON.stringify(performanceResult.rows[0], null, 2));
    }
    
    performanceResult.rows.forEach((row, index) => {
      const data = row.data;
      
      console.log(`📊 Using latest MTD snapshot for ${row.store_name || 'Unknown Store'}: ${data.invoices} invoices, $${data.sales} sales`);
      
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      // Aggregate all numeric fields from main data (skip percentages - we'll recalculate those)
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
          // Skip percentage fields - we'll recalculate them from the aggregated counts
          if (key.toLowerCase().includes('percent') || key.endsWith('%')) {
            console.log(`⏭️ Skipping percentage field ${key} during aggregation - will recalculate from totals`);
            return;
          }
          
          aggregatedData[key] = (aggregatedData[key] || 0) + data[key];
          // Debug potential alignments fields
          if (key.toLowerCase().includes('potential')) {
            console.log(`🎯 Aggregating ${key}: ${data[key]} -> total: ${aggregatedData[key]}`);
          }
        }
      });
      
      // Aggregate otherServices nested data (skip percentages - we'll recalculate those)
      if (data.otherServices) {
        Object.keys(data.otherServices).forEach(key => {
          const value = parseFloat(data.otherServices[key]);
          if (!isNaN(value)) {
            // Skip percentage fields in otherServices too - we'll recalculate them
            if (key.toLowerCase().includes('%') || key.toLowerCase().includes('percent')) {
              console.log(`⏭️ Skipping percentage field ${key} in otherServices during aggregation - will recalculate from totals`);
              return;
            }
            
            aggregatedOtherServices[key] = (aggregatedOtherServices[key] || 0) + value;
            // Debug potential alignments in otherServices
            if (key.toLowerCase().includes('potential')) {
              console.log(`🎯 Found in otherServices - ${key}: ${value} -> total: ${aggregatedOtherServices[key]}`);
            }
          }
        });
      }
    });
    
    console.log(`📊 User ${userId} totals: ${metrics.invoices} invoices, $${metrics.sales} sales, ${Object.keys(aggregatedData).length + Object.keys(aggregatedOtherServices).length} service types`);
    
    // Debug: Show all keys that contain "potential" in aggregatedData
    const potentialKeys = Object.keys(aggregatedData).filter(key => key.toLowerCase().includes('potential'));
    if (potentialKeys.length > 0) {
      console.log(`🎯 Found potential alignment keys in aggregatedData:`, potentialKeys.map(k => `${k}: ${aggregatedData[k]}`));
    } else {
      console.log(`❌ No potential alignment keys found in aggregatedData`);
    }
    
    // Debug: Show all keys in aggregatedData for inspection
    console.log(`📊 All aggregatedData keys:`, Object.keys(aggregatedData));
    
    // Check if the data has the camelCase versions
    console.log(`🔍 Checking camelCase fields:
      - potentialAlignments: ${aggregatedData.potentialAlignments || 'NOT FOUND'}
      - potentialAlignmentsSold: ${aggregatedData.potentialAlignmentsSold || 'NOT FOUND'}
      - potentialAlignmentsPercent: ${aggregatedData.potentialAlignmentsPercent || 'NOT FOUND'}`);
    
    // Calculate GP% and recalculate other percentages from aggregated totals
    metrics.gpPercent = metrics.sales > 0 ? (metrics.gpSales / metrics.sales) * 100 : 0;
    
    // Recalculate percentage fields from aggregated counts (don't sum percentages!)
    
    // Potential Alignments % - check both locations for the counts
    const potentialAlignments = aggregatedData.potentialAlignments || aggregatedOtherServices['Potential Alignments'] || 0;
    const potentialAlignmentsSold = aggregatedData.potentialAlignmentsSold || aggregatedOtherServices['Potential Alignments Sold'] || 0;
    
    if (potentialAlignments > 0) {
      const potentialAlignmentsPercent = Math.ceil((potentialAlignmentsSold / potentialAlignments) * 100);
      
      // Store recalculated percentage in both places to ensure it's found
      aggregatedData.potentialAlignmentsPercent = potentialAlignmentsPercent;
      aggregatedOtherServices['Potential Alignments %'] = potentialAlignmentsPercent;
      
      console.log(`📊 Recalculated Potential Alignments %: ${potentialAlignmentsSold} / ${potentialAlignments} = ${potentialAlignmentsPercent}% (rounded up)`);
    } else {
      // When no potential alignments, percentage is 0%
      aggregatedData.potentialAlignmentsPercent = 0;
      aggregatedOtherServices['Potential Alignments %'] = 0;
      
      console.log(`📊 Potential Alignments %: 0% (no potential alignments)`);
    }
    
    // Tire Protection %
    const retailTires = aggregatedData.retailTires || aggregatedOtherServices['Retail Tires'] || 0;
    const tireProtection = aggregatedData.tireProtection || aggregatedOtherServices['Tire Protection'] || 0;
    
    if (retailTires > 0) {
      const tireProtectionPercent = Math.ceil((tireProtection / retailTires) * 100);
      aggregatedData.tireProtectionPercent = tireProtectionPercent;
      aggregatedOtherServices['Tire Protection %'] = tireProtectionPercent;
      
      console.log(`📊 Recalculated Tire Protection %: ${tireProtection} / ${retailTires} = ${tireProtectionPercent}% (rounded up)`);
    } else {
      // When no retail tires, percentage is 0%
      aggregatedData.tireProtectionPercent = 0;
      aggregatedOtherServices['Tire Protection %'] = 0;
      
      console.log(`📊 Tire Protection %: 0% (no retail tires)`);
    }
    
    // Brake Flush to Service %
    const brakeService = aggregatedData.brakeService || aggregatedOtherServices['Brake Service'] || 0;
    const brakeFlush = aggregatedData.brakeFlush || aggregatedOtherServices['Brake Flush'] || 0;
    
    if (brakeService > 0) {
      const brakeFlushToServicePercent = Math.ceil((brakeFlush / brakeService) * 100);
      aggregatedData.brakeFlushToServicePercent = brakeFlushToServicePercent;
      aggregatedOtherServices['Brake Flush to Service %'] = brakeFlushToServicePercent;
      
      console.log(`📊 Recalculated Brake Flush to Service %: ${brakeFlush} / ${brakeService} = ${brakeFlushToServicePercent}% (rounded up)`);
    } else {
      // When no brake services, percentage is 0%
      aggregatedData.brakeFlushToServicePercent = 0;
      aggregatedOtherServices['Brake Flush to Service %'] = 0;
      
      console.log(`📊 Brake Flush to Service %: 0% (no brake services)`);
    }
    
    // Debug: Show the full aggregatedData for brake flush fields
    console.log(`🔍 aggregatedData brake fields:`, {
      brakeService: aggregatedData.brakeService,
      brakeFlush: aggregatedData.brakeFlush,
      brakeFlushToServicePercent: aggregatedData.brakeFlushToServicePercent
    });
    
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
      'headlightrestorationservice': { type: 'nested', field: 'Headlight Restoration Service', label: 'Headlight Restoration Service' },
      
      // Percentage fields - these are recalculated from aggregated counts
      'tireprotection%': { type: 'direct', field: 'tireProtectionPercent', label: 'Tire Protection %' },
      'potentialalignments%': { type: 'direct', field: 'potentialAlignmentsPercent', label: 'Potential Alignments %' },
      'brakeflushtoservice%': { type: 'direct', field: 'brakeFlushToServicePercent', label: 'Brake Flush to Service %' },
      
      // Alignment fields - these are in main data, not nested otherServices
      'potentialalignments': { type: 'direct', field: 'potentialAlignments', label: 'Potential Alignments' },
      'potentialalignmentssold': { type: 'direct', field: 'potentialAlignmentsSold', label: 'Potential Alignments Sold' },
      'premiumalignments': { type: 'nested', field: 'Premium Alignments', label: 'Premium Alignments' },
      
      // Oil change variants
      'syntheticoilchange': { type: 'nested', field: 'Synthetic Oil Change', label: 'Synthetic Oil Change' },
      'syntheticblendoilchange': { type: 'nested', field: 'Synthetic Blend Oil Change', label: 'Synthetic Blend Oil Change' },
      
      // Core metrics
      'invoices': { type: 'calculated', field: 'invoices', label: 'Invoices' },
      'sales': { type: 'calculated', field: 'sales', label: 'Sales' },
      'gpsales': { type: 'calculated', field: 'gpSales', label: 'GP Sales' },
      'gppercent': { type: 'calculated', field: 'gpPercent', label: 'GP Percent' },
      'avg.spend': { type: 'calculated', field: 'avgSpend', label: 'Avg. Spend' },
      
      // Filter services
      'fuelfilter': { type: 'nested', field: 'Fuel Filter', label: 'Fuel Filter' }
    };
    
    // Process all template field mappings - include ALL services, even with zero values
    Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
      let value = 0;
      
      if (mapping.type === 'direct') {
        value = aggregatedData[mapping.field] || 0;
        // Debug potential alignments mapping
        if (templateKey.includes('potential')) {
          console.log(`🎯 Mapping ${templateKey} (${mapping.field}): ${value} from aggregatedData`);
        }
        // Debug brake flush percentage mapping
        if (templateKey === 'brakeflushtoservice%') {
          console.log(`🔧 Mapping Brake Flush to Service % - templateKey: ${templateKey}, field: ${mapping.field}`);
          console.log(`   aggregatedData.${mapping.field} = ${aggregatedData[mapping.field]}`);
          console.log(`   aggregatedData.brakeFlushToServicePercent = ${aggregatedData.brakeFlushToServicePercent}`);
          console.log(`   Final value = ${value}`);
        }
      } else if (mapping.type === 'nested') {
        value = aggregatedOtherServices[mapping.field] || 0;
        // Debug potential alignments in nested
        if (templateKey.includes('potential')) {
          console.log(`🎯 Mapping ${templateKey} (${mapping.field}): ${value} from aggregatedOtherServices`);
          console.log(`   Available in otherServices:`, Object.keys(aggregatedOtherServices).filter(k => k.toLowerCase().includes('potential')));
        }
      } else if (mapping.type === 'calculated') {
        // Handle calculated fields from metrics
        if (mapping.field === 'invoices') {
          value = metrics.invoices;
        } else if (mapping.field === 'sales') {
          value = metrics.sales;
        } else if (mapping.field === 'gpSales') {
          value = metrics.gpSales;
        } else if (mapping.field === 'gpPercent') {
          value = metrics.gpPercent;
        } else if (mapping.field === 'avgSpend') {
          value = metrics.invoices > 0 ? metrics.sales / metrics.invoices : 0;
        }
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
      
      // Debug: Log potential alignments being added to mappedServices
      if (displayName.toLowerCase().includes('potential alignment')) {
        console.log(`✅ Adding to final services: "${displayName}" = ${value}`);
      }
    });
    
    // Final debug: Show all potential alignment fields in the response
    console.log(`📋 Final mapped services with potential alignments:`, 
      Object.entries(mappedServices)
        .filter(([key]) => key.toLowerCase().includes('potential') || key.toLowerCase().includes('alignment'))
        .map(([key, val]) => `${key}: ${val}`)
    );
    
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
        gpPercent: Math.ceil(metrics.gpPercent)
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

// Get advisor scorecard with store breakdown (for multi-store advisors)
router.get('/advisor/:userId/by-store', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const { mtdMonth, mtdYear } = req.query;
    
    // Check permissions - advisors can only see their own scorecard
    if (req.user.role === 'advisor' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ message: 'Forbidden: You can only view your own scorecard' });
    }
    
    // Get the LATEST performance data for specific MTD month grouped by store
    let performanceResult;
    
    if (mtdMonth && mtdYear) {
      console.log(`📊 Getting store-separated MTD data for ${mtdYear}-${mtdMonth.padStart(2, '0')} for user ${userId}`);
      
      performanceResult = await pool.query(`
        WITH latest_per_store AS (
          SELECT 
            pd.upload_date,
            pd.data,
            pd.store_id,
            s.name as store_name,
            s.id as store_id_numeric,
            s.market_id,
            m.name as market_name,
            ROW_NUMBER() OVER (
              PARTITION BY pd.store_id 
              ORDER BY pd.upload_date DESC
            ) as rn
          FROM performance_data pd
          LEFT JOIN stores s ON pd.store_id::text = s.id::text
          LEFT JOIN markets m ON s.market_id = m.id
          WHERE pd.advisor_user_id = $1
            AND pd.data_type = 'services'
            AND EXTRACT(YEAR FROM pd.upload_date) = $2
            AND EXTRACT(MONTH FROM pd.upload_date) = $3
        )
        SELECT 
          upload_date,
          data,
          store_id,
          store_name,
          store_id_numeric,
          market_id,
          market_name
        FROM latest_per_store 
        WHERE rn = 1
        ORDER BY store_name
      `, [userId, parseInt(mtdYear), parseInt(mtdMonth)]);
    } else {
      // Use current month if no MTD specified
      const now = new Date();
      performanceResult = await pool.query(`
        WITH latest_per_store AS (
          SELECT 
            pd.upload_date,
            pd.data,
            pd.store_id,
            s.name as store_name,
            s.id as store_id_numeric,
            s.market_id,
            m.name as market_name,
            ROW_NUMBER() OVER (
              PARTITION BY pd.store_id 
              ORDER BY pd.upload_date DESC
            ) as rn
          FROM performance_data pd
          LEFT JOIN stores s ON pd.store_id::text = s.id::text
          LEFT JOIN markets m ON s.market_id = m.id
          WHERE pd.advisor_user_id = $1
            AND pd.data_type = 'services'
            AND EXTRACT(YEAR FROM pd.upload_date) = $2
            AND EXTRACT(MONTH FROM pd.upload_date) = $3
        )
        SELECT 
          upload_date,
          data,
          store_id,
          store_name,
          store_id_numeric,
          market_id,
          market_name
        FROM latest_per_store 
        WHERE rn = 1
        ORDER BY store_name
      `, [userId, now.getFullYear(), now.getMonth() + 1]);
    }
    
    console.log(`📊 Store-separated scorecard for user ${userId}: Found ${performanceResult.rows.length} performance records`);
    
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
    
    // Group performance data by store
    const storePerformance = new Map();
    const totalMetrics = {
      invoices: 0,
      sales: 0,
      gpSales: 0,
      services: {}
    };
    
    // Process each performance record
    performanceResult.rows.forEach((row) => {
      // Better store key logic - use numeric ID if available, otherwise string ID
      const storeKey = row.store_id_numeric || row.store_id || 'unknown';
      const storeName = row.store_name || `Store ${storeKey}`;
      
      // Debug logging for store separation
      console.log(`📊 Processing record: Store ID: ${row.store_id}, Numeric ID: ${row.store_id_numeric}, Name: ${row.store_name}, Key: ${storeKey}`);
      
      if (!storePerformance.has(storeKey)) {
        storePerformance.set(storeKey, {
          storeId: row.store_id_numeric || row.store_id || storeKey,
          storeName: storeName,
          marketId: row.market_id,
          marketName: row.market_name,
          records: [],
          metrics: {
            invoices: 0,
            sales: 0,
            gpSales: 0,
            services: {}
          }
        });
        console.log(`🏪 Created new store group: ${storeKey} (${storeName})`);
      }
      
      const storeData = storePerformance.get(storeKey);
      storeData.records.push(row);
      
      const data = row.data;
      
      // Debug: Show latest MTD data for this store
      console.log(`📊 Latest MTD for ${storeName}: Invoices: ${data.invoices}, Sales: ${data.sales}, GP Sales: ${data.gpSales}, Upload: ${row.upload_date}`);
      
      // Use latest MTD metrics (no aggregation needed since we have one record per store)
      storeData.metrics.invoices = parseInt(data.invoices || 0);
      storeData.metrics.sales = parseFloat(data.sales || 0);
      storeData.metrics.gpSales = parseFloat(data.gpSales || 0);
      
      // Aggregate total metrics (for rollup)
      totalMetrics.invoices += parseInt(data.invoices || 0);
      totalMetrics.sales += parseFloat(data.sales || 0);
      totalMetrics.gpSales += parseFloat(data.gpSales || 0);
      
      // Use latest MTD services (no aggregation needed since we have one record per store)
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
          storeData.metrics.services[key] = data[key]; // Use latest value directly
          totalMetrics.services[key] = (totalMetrics.services[key] || 0) + data[key]; // Still aggregate for rollup
          
          // Debug: Log service values for All Tires
          if (key === 'allTires' && data[key] > 0) {
            console.log(`🔧 Latest allTires for ${storeName}: ${data[key]} (rollup total now: ${totalMetrics.services[key]})`);
          }
        }
      });
      
      // Use latest MTD otherServices
      if (data.otherServices) {
        Object.keys(data.otherServices).forEach(key => {
          const value = parseFloat(data.otherServices[key]);
          if (!isNaN(value)) {
            storeData.metrics.services[key] = value; // Use latest value directly
            totalMetrics.services[key] = (totalMetrics.services[key] || 0) + value; // Still aggregate for rollup
            
            // Debug: Log All Tires from otherServices
            if (key === 'All Tires' && value > 0) {
              console.log(`🔧 Latest 'All Tires' in otherServices for ${storeName}: ${value} (rollup total now: ${totalMetrics.services[key]})`);
            }
          }
        });
      }
    });
    
    // Calculate GP% for each store and total
    storePerformance.forEach((storeData, storeKey) => {
      storeData.metrics.gpPercent = storeData.metrics.sales > 0 
        ? (storeData.metrics.gpSales / storeData.metrics.sales) * 100 
        : 0;
      
      // Debug: Show final store totals
      console.log(`🏪 Final totals for ${storeData.storeName} (Key: ${storeKey}):`);
      console.log(`   Invoices: ${storeData.metrics.invoices}`);
      console.log(`   Sales: $${storeData.metrics.sales}`);
      console.log(`   GP Sales: $${storeData.metrics.gpSales}`);
      console.log(`   GP %: ${storeData.metrics.gpPercent.toFixed(1)}%`);
      console.log(`   Records: ${storeData.records.length}`);
    });
    
    totalMetrics.gpPercent = totalMetrics.sales > 0 
      ? (totalMetrics.gpSales / totalMetrics.sales) * 100 
      : 0;
    
    // Apply service mapping for consistent field names (same logic as main endpoint)
    const templateFieldMappings = {
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
      'headlightrestorationservice': { type: 'nested', field: 'Headlight Restoration Service', label: 'Headlight Restoration Service' },
      'invoices': { type: 'calculated', field: 'invoices', label: 'Invoices' },
      'sales': { type: 'calculated', field: 'sales', label: 'Sales' },
      'gpsales': { type: 'calculated', field: 'gpSales', label: 'GP Sales' },
      'gppercent': { type: 'calculated', field: 'gpPercent', label: 'GP Percent' },
      'avg.spend': { type: 'calculated', field: 'avgSpend', label: 'Avg. Spend' },
      
      // Percentage fields - need special handling for individual stores
      'tireprotection%': { type: 'percentage', field: 'tireProtectionPercent', label: 'Tire Protection %' },
      'potentialalignments%': { type: 'percentage', field: 'potentialAlignmentsPercent', label: 'Potential Alignments %' },
      'brakeflushtoservice%': { type: 'percentage', field: 'brakeFlushToServicePercent', label: 'Brake Flush to Service %' },
      
      // Potential alignment count fields
      'potentialalignments': { type: 'direct', field: 'potentialAlignments', label: 'Potential Alignments' },
      'potentialalignmentssold': { type: 'direct', field: 'potentialAlignmentsSold', label: 'Potential Alignments Sold' }
    };
    
    // Apply mapping to each store's services
    const mappedStoreData = Array.from(storePerformance.values()).map(storeData => {
      const mappedServices = {};
      
      Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
        let value = 0;
        
        if (mapping.type === 'direct') {
          value = storeData.metrics.services[mapping.field] || 0;
        } else if (mapping.type === 'nested') {
          value = storeData.metrics.services[mapping.field] || 0;
        } else if (mapping.type === 'percentage') {
          // Handle percentage fields with proper calculation for individual stores
          if (mapping.field === 'brakeFlushToServicePercent') {
            const brakeService = storeData.metrics.services['brakeService'] || 0;
            const brakeFlush = storeData.metrics.services['brakeFlush'] || 0;
            value = brakeService > 0 ? Math.ceil((brakeFlush / brakeService) * 100) : 0;
            console.log(`🔧 BY-STORE: ${storeData.storeName} - Brake Service: ${brakeService}, Brake Flush: ${brakeFlush}, Calculated %: ${value}`);
          } else if (mapping.field === 'potentialAlignmentsPercent') {
            const potentialAlignments = storeData.metrics.services['potentialAlignments'] || 0;
            const potentialAlignmentsSold = storeData.metrics.services['potentialAlignmentsSold'] || 0;
            value = potentialAlignments > 0 ? Math.ceil((potentialAlignmentsSold / potentialAlignments) * 100) : 0;
          } else if (mapping.field === 'tireProtectionPercent') {
            const retailTires = storeData.metrics.services['retailTires'] || 0;
            const tireProtection = storeData.metrics.services['tireProtection'] || 0;
            value = retailTires > 0 ? Math.ceil((tireProtection / retailTires) * 100) : 0;
          } else {
            // Fallback to stored percentage value
            value = storeData.metrics.services[mapping.field] || 0;
          }
        } else if (mapping.type === 'calculated') {
          if (mapping.field === 'invoices') {
            value = storeData.metrics.invoices;
          } else if (mapping.field === 'sales') {
            value = storeData.metrics.sales;
          } else if (mapping.field === 'gpSales') {
            value = storeData.metrics.gpSales;
          } else if (mapping.field === 'gpPercent') {
            value = storeData.metrics.gpPercent;
          } else if (mapping.field === 'avgSpend') {
            value = storeData.metrics.invoices > 0 ? storeData.metrics.sales / storeData.metrics.invoices : 0;
          }
        }
        
        let displayName = mapping.label;
        
        // Apply vendor mappings
        let vendorMapping = null;
        if (vendorMappings[templateKey]) {
          vendorMapping = Object.values(vendorMappings[templateKey])[0];
        } else if (vendorMappings[mapping.label]) {
          vendorMapping = Object.values(vendorMappings[mapping.label])[0];
        } else if (mapping.type === 'direct' && vendorMappings[mapping.field]) {
          vendorMapping = Object.values(vendorMappings[mapping.field])[0];
        }
        
        if (vendorMapping) {
          displayName = vendorMapping.productName;
        }
        
        mappedServices[displayName] = value;
      });
      
      return {
        storeId: storeData.storeId,
        storeName: storeData.storeName,
        marketId: storeData.marketId,
        marketName: storeData.marketName,
        metrics: {
          invoices: storeData.metrics.invoices,
          sales: storeData.metrics.sales,
          gpSales: storeData.metrics.gpSales,
          gpPercent: storeData.metrics.gpPercent.toFixed(1)
        },
        services: mappedServices,
        recordCount: storeData.records.length
      };
    });
    
    // Apply mapping to total services
    const mappedTotalServices = {};
    Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
      let value = 0;
      
      if (mapping.type === 'direct') {
        value = totalMetrics.services[mapping.field] || 0;
      } else if (mapping.type === 'nested') {
        value = totalMetrics.services[mapping.field] || 0;
      } else if (mapping.type === 'percentage') {
        // Handle percentage fields with proper calculation for combined totals
        if (mapping.field === 'brakeFlushToServicePercent') {
          const brakeService = totalMetrics.services['brakeService'] || 0;
          const brakeFlush = totalMetrics.services['brakeFlush'] || 0;
          value = brakeService > 0 ? Math.ceil((brakeFlush / brakeService) * 100) : 0;
        } else if (mapping.field === 'potentialAlignmentsPercent') {
          const potentialAlignments = totalMetrics.services['potentialAlignments'] || 0;
          const potentialAlignmentsSold = totalMetrics.services['potentialAlignmentsSold'] || 0;
          value = potentialAlignments > 0 ? Math.ceil((potentialAlignmentsSold / potentialAlignments) * 100) : 0;
        } else if (mapping.field === 'tireProtectionPercent') {
          const retailTires = totalMetrics.services['retailTires'] || 0;
          const tireProtection = totalMetrics.services['tireProtection'] || 0;
          value = retailTires > 0 ? Math.ceil((tireProtection / retailTires) * 100) : 0;
        } else {
          // Fallback to stored percentage value
          value = totalMetrics.services[mapping.field] || 0;
        }
      } else if (mapping.type === 'calculated') {
        if (mapping.field === 'invoices') {
          value = totalMetrics.invoices;
        } else if (mapping.field === 'sales') {
          value = totalMetrics.sales;
        } else if (mapping.field === 'gpSales') {
          value = totalMetrics.gpSales;
        } else if (mapping.field === 'gpPercent') {
          value = totalMetrics.gpPercent;
        } else if (mapping.field === 'avgSpend') {
          value = totalMetrics.invoices > 0 ? totalMetrics.sales / totalMetrics.invoices : 0;
        }
      }
      
      let displayName = mapping.label;
      
      // Apply vendor mappings
      let vendorMapping = null;
      if (vendorMappings[templateKey]) {
        vendorMapping = Object.values(vendorMappings[templateKey])[0];
      } else if (vendorMappings[mapping.label]) {
        vendorMapping = Object.values(vendorMappings[mapping.label])[0];
      } else if (mapping.type === 'direct' && vendorMappings[mapping.field]) {
        vendorMapping = Object.values(vendorMappings[mapping.field])[0];
      }
      
      if (vendorMapping) {
        displayName = vendorMapping.productName;
      }
      
      mappedTotalServices[displayName] = value;
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
    
    // Get primary market ID (from first store if multiple)
    const primaryMarketId = mappedStoreData.length > 0 ? mappedStoreData[0].marketId : null;
    const primaryMarketName = mappedStoreData.length > 0 ? mappedStoreData[0].marketName : null;
    
    // Build response
    const response = {
      userId: parseInt(userId),
      isMultiStore: mappedStoreData.length > 1,
      totalStores: mappedStoreData.length,
      marketId: primaryMarketId,
      marketName: primaryMarketName,
      rollupData: {
        metrics: {
          invoices: totalMetrics.invoices,
          sales: totalMetrics.sales,
          gpSales: totalMetrics.gpSales,
          gpPercent: totalMetrics.gpPercent.toFixed(1)
        },
        services: mappedTotalServices,
        goals: goals
      },
      storeData: mappedStoreData,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`📊 Store-separated response for user ${userId}: ${mappedStoreData.length} stores, rollup: ${totalMetrics.invoices} invoices, $${totalMetrics.sales} sales`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Error getting store-separated advisor scorecard:', error);
    res.status(500).json({ message: 'Failed to get store-separated advisor scorecard' });
  }
});

// Get store scorecards for a market
router.get('/stores/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    const { mtdMonth, mtdYear } = req.query;
    
    // Check permissions - advisors cannot view store scorecards
    if (req.user.role === 'advisor') {
      return res.status(403).json({ message: 'Forbidden: Advisors cannot view store scorecards' });
    }
    
    console.log(`🏪 Getting store scorecards for market ${marketId}, MTD: ${mtdYear}-${mtdMonth}`);
    
    // Parse MTD parameters or use current month
    let targetYear, targetMonth;
    if (mtdMonth && mtdYear) {
      targetYear = parseInt(mtdYear);
      targetMonth = parseInt(mtdMonth);
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }
    
    // Get all stores in the market
    const storesResult = await pool.query(`
      SELECT id, name, market_id
      FROM stores 
      WHERE market_id = $1 
      ORDER BY name
    `, [marketId]);
    
    if (storesResult.rows.length === 0) {
      return res.status(404).json({ message: 'No stores found for this market' });
    }
    
    console.log(`🏪 Found ${storesResult.rows.length} stores in market ${marketId}`);
    
    // Get vendor mappings for this market
    const vendorMappingsResult = await pool.query(`
      SELECT DISTINCT
        vpm.vendor_id,
        vpm.service_field,
        vpm.product_name,
        vt.name as vendor_name
      FROM market_tags mt
      JOIN vendor_product_mappings vpm ON vpm.vendor_id = mt.tag_id
      JOIN vendor_tags vt ON vt.id = vpm.vendor_id
      WHERE mt.market_id = $1
    `, [marketId]);
    
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
    
    console.log(`📦 Market ${marketId} vendor mappings:`, vendorMappingsResult.rows.map(r => `${r.service_field} -> ${r.product_name}`));
    
    // Process each store
    const storeScoreCards = [];
    
    for (const store of storesResult.rows) {
      console.log(`\n🏪 Processing store: ${store.name} (ID: ${store.id})`);
      
      // Get latest store-level performance data for this store for the target month
      const performanceResult = await pool.query(`
        SELECT 
          pd.data
        FROM performance_data pd
        WHERE pd.store_id = $1
          AND pd.data_type = 'services'
          AND pd.advisor_user_id IS NULL
          AND EXTRACT(YEAR FROM pd.upload_date) = $2
          AND EXTRACT(MONTH FROM pd.upload_date) = $3
        ORDER BY pd.upload_date DESC, pd.id DESC
        LIMIT 1
      `, [store.id, targetYear, targetMonth]);
      
      if (performanceResult.rows.length === 0) {
        console.log(`⚠️ No store-level performance data found for store ${store.name} in ${targetYear}-${targetMonth.toString().padStart(2, '0')}`);
        continue;
      }
      
      console.log(`📊 Found store-level performance data for ${store.name}`);
      
      // Use direct store data (no aggregation needed)
      const storeData = performanceResult.rows[0].data;
      
      const storeMetrics = {
        invoices: parseInt(storeData.invoices || 0),
        sales: parseFloat(storeData.sales || 0),
        gpSales: parseFloat(storeData.gpSales || 0),
        gpPercent: parseFloat(storeData.gpPercent || 0)
      };
      
      // Use the data directly (no aggregation)
      const aggregatedData = { ...storeData };
      const aggregatedOtherServices = storeData.otherServices || {};
      
      // Recalculate percentage fields from aggregated counts
      const potentialAlignments = aggregatedData.potentialAlignments || aggregatedOtherServices['Potential Alignments'] || 0;
      const potentialAlignmentsSold = aggregatedData.potentialAlignmentsSold || aggregatedOtherServices['Potential Alignments Sold'] || 0;
      
      if (potentialAlignments > 0) {
        const potentialAlignmentsPercent = Math.ceil((potentialAlignmentsSold / potentialAlignments) * 100);
        aggregatedData.potentialAlignmentsPercent = potentialAlignmentsPercent;
        aggregatedOtherServices['Potential Alignments %'] = potentialAlignmentsPercent;
      } else {
        aggregatedData.potentialAlignmentsPercent = 0;
        aggregatedOtherServices['Potential Alignments %'] = 0;
      }
      
      // Brake flush to service percentage
      const brakeService = aggregatedData.brakeService || 0;
      const brakeFlush = aggregatedData.brakeFlush || 0;
      
      if (brakeService > 0) {
        const brakeFlushToServicePercent = Math.ceil((brakeFlush / brakeService) * 100);
        aggregatedData.brakeFlushToServicePercent = brakeFlushToServicePercent;
        aggregatedOtherServices['Brake Flush to Service %'] = brakeFlushToServicePercent;
      } else {
        aggregatedData.brakeFlushToServicePercent = 0;
        aggregatedOtherServices['Brake Flush to Service %'] = 0;
      }
      
      // Tire protection percentage
      const allTires = aggregatedData.allTires || aggregatedData.retailTires || 0;
      const tireProtection = aggregatedData.tireProtection || 0;
      
      if (allTires > 0) {
        const tireProtectionPercent = Math.ceil((tireProtection / allTires) * 100);
        aggregatedData.tireProtectionPercent = tireProtectionPercent;
      } else {
        aggregatedData.tireProtectionPercent = 0;
      }
      
      // Apply the same template field mappings as advisor scorecards
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
        'tpms': { type: 'nested', field: 'TPMS', label: 'TPMS' },
        'tirebalance': { type: 'nested', field: 'Tire Balance', label: 'Tire Balance' },
        'tirerotation': { type: 'nested', field: 'Tire Rotation', label: 'Tire Rotation' },
        'batteryservice': { type: 'nested', field: 'Battery Service', label: 'Battery Service' },
        'engineperformanceservice': { type: 'nested', field: 'Engine Performance Service', label: 'Engine Performance Service' },
        'sparkplugreplacement': { type: 'nested', field: 'Spark Plug Replacement', label: 'Spark Plug Replacement' },
        'completevehicleinspection': { type: 'nested', field: 'Complete Vehicle Inspection', label: 'Complete Vehicle Inspection' },
        'climatecontrolservice': { type: 'nested', field: 'Climate Control Service', label: 'Climate Control Service' },
        'hosereplacement': { type: 'nested', field: 'Hose Replacement', label: 'Hose Replacement' },
        'beltsreplacement': { type: 'nested', field: 'Belts Replacement', label: 'Belts Replacement' },
        'headlightrestorationservice': { type: 'nested', field: 'Headlight Restoration Service', label: 'Headlight Restoration Service' },
        'nitrogen': { type: 'nested', field: 'Nitrogen', label: 'Nitrogen' },
        'timingbelt': { type: 'nested', field: 'Timing Belt', label: 'Timing Belt' },
        'transfercaseservice': { type: 'nested', field: 'Transfer Case Service', label: 'Transfer Case Service' },
        
        // Percentage fields - these are recalculated from aggregated counts
        'tireprotection%': { type: 'direct', field: 'tireProtectionPercent', label: 'Tire Protection %' },
        'potentialalignments%': { type: 'direct', field: 'potentialAlignmentsPercent', label: 'Potential Alignments %' },
        'brakeflushtoservice%': { type: 'direct', field: 'brakeFlushToServicePercent', label: 'Brake Flush to Service %' },
        
        // Alignment fields - these are in main data, not nested otherServices
        'potentialalignments': { type: 'direct', field: 'potentialAlignments', label: 'Potential Alignments' },
        'potentialalignmentssold': { type: 'direct', field: 'potentialAlignmentsSold', label: 'Potential Alignments Sold' },
        'premiumalignments': { type: 'nested', field: 'Premium Alignments', label: 'Premium Alignments' },
        
        // Oil change variants
        'syntheticoilchange': { type: 'nested', field: 'Synthetic Oil Change', label: 'Synthetic Oil Change' },
        'syntheticblendoilchange': { type: 'nested', field: 'Synthetic Blend Oil Change', label: 'Synthetic Blend Oil Change' },
        
        // Core metrics
        'invoices': { type: 'calculated', field: 'invoices', label: 'Invoices' },
        'sales': { type: 'calculated', field: 'sales', label: 'Sales' },
        'gpsales': { type: 'calculated', field: 'gpSales', label: 'GP Sales' },
        'gppercent': { type: 'calculated', field: 'gpPercent', label: 'GP Percent' },
        'avg.spend': { type: 'calculated', field: 'avgSpend', label: 'Avg. Spend' },
        
        // Filter services
        'fuelfilter': { type: 'nested', field: 'Fuel Filter', label: 'Fuel Filter' }
      };
      
      // Map services using vendor mappings
      const mappedServices = {};
      
      Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
        let value = 0;
        
        if (mapping.type === 'direct') {
          value = aggregatedData[mapping.field] || 0;
        } else if (mapping.type === 'nested') {
          value = aggregatedOtherServices[mapping.field] || 0;
        } else if (mapping.type === 'calculated') {
          if (mapping.field === 'invoices') {
            value = storeMetrics.invoices;
          } else if (mapping.field === 'sales') {
            value = storeMetrics.sales;
          } else if (mapping.field === 'gpSales') {
            value = storeMetrics.gpSales;
          } else if (mapping.field === 'gpPercent') {
            value = storeMetrics.gpPercent;
          } else if (mapping.field === 'avgSpend') {
            value = storeMetrics.invoices > 0 ? storeMetrics.sales / storeMetrics.invoices : 0;
          }
        }
        
        let displayName = mapping.label;
        
        // Apply vendor mappings
        let vendorMapping = null;
        if (vendorMappings[templateKey]) {
          vendorMapping = Object.values(vendorMappings[templateKey])[0];
        } else if (vendorMappings[mapping.label]) {
          vendorMapping = Object.values(vendorMappings[mapping.label])[0];
        } else if (mapping.type === 'direct' && vendorMappings[mapping.field]) {
          vendorMapping = Object.values(vendorMappings[mapping.field])[0];
        }
        
        if (vendorMapping) {
          displayName = vendorMapping.productName;
        }
        
        mappedServices[displayName] = value;
      });
      
      // Get store goals
      const storeGoalsResult = await pool.query(`
        SELECT 
          metric_name,
          target_value,
          period_type,
          effective_date
        FROM goals
        WHERE goal_type = 'store'
          AND store_id = $1
          AND effective_date <= CURRENT_DATE
        ORDER BY effective_date DESC
      `, [store.id]);
      
      const goals = {};
      storeGoalsResult.rows.forEach(row => {
        if (!goals[row.metric_name]) {
          goals[row.metric_name] = {
            target: parseFloat(row.target_value),
            periodType: row.period_type,
            effectiveDate: row.effective_date
          };
        }
      });
      
      // Get store manager info (currently not available - would need manager_user_id column)
      let managerInfo = null;
      // TODO: Add manager_user_id column to stores table and implement manager lookup
      
      storeScoreCards.push({
        storeId: store.id,
        storeName: store.name,
        marketId: store.market_id,
        managerInfo,
        advisorCount: parseInt(storeData.advisorCount || 0), // From store data or default to 0
        metrics: {
          invoices: storeMetrics.invoices,
          sales: storeMetrics.sales,
          gpSales: storeMetrics.gpSales,
          gpPercent: Math.ceil(storeMetrics.gpPercent),
          avgSpend: storeMetrics.invoices > 0 ? storeMetrics.sales / storeMetrics.invoices : 0
        },
        services: mappedServices,
        goals: goals,
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`✅ Store ${store.name}: ${storeMetrics.invoices} invoices, $${storeMetrics.sales} sales`);
    }
    
    console.log(`🏪 Processed ${storeScoreCards.length} stores for market ${marketId}`);
    
    res.json({
      marketId: parseInt(marketId),
      period: {
        year: targetYear,
        month: targetMonth
      },
      stores: storeScoreCards,
      totalStores: storeScoreCards.length,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting store scorecards:', error);
    res.status(500).json({ message: 'Failed to get store scorecards' });
  }
});

// Get market scorecards 
router.get('/markets', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { mtdMonth, mtdYear } = req.query;
    
    // Check permissions - advisors cannot view market scorecards
    if (req.user.role === 'advisor') {
      return res.status(403).json({ message: 'Forbidden: Advisors cannot view market scorecards' });
    }
    
    console.log(`🏬 Getting market scorecards for MTD: ${mtdYear}-${mtdMonth}`);
    
    // Parse MTD parameters or use current month
    let targetYear, targetMonth;
    if (mtdMonth && mtdYear) {
      targetYear = parseInt(mtdYear);
      targetMonth = parseInt(mtdMonth);
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }
    
    // Get all markets
    const marketsResult = await pool.query(`
      SELECT id, name, description
      FROM markets 
      ORDER BY name
    `);
    
    if (marketsResult.rows.length === 0) {
      return res.status(404).json({ message: 'No markets found' });
    }
    
    console.log(`🏬 Found ${marketsResult.rows.length} markets`);
    
    // Get vendor mappings for all markets
    const vendorMappingsResult = await pool.query(`
      SELECT DISTINCT
        vpm.vendor_id,
        vpm.service_field,
        vpm.product_name,
        vt.name as vendor_name,
        mt.market_id
      FROM market_tags mt
      JOIN vendor_product_mappings vpm ON vpm.vendor_id = mt.tag_id
      JOIN vendor_tags vt ON vt.id = vpm.vendor_id
    `);
    
    // Build vendor mapping lookup
    const vendorMappings = {};
    vendorMappingsResult.rows.forEach(row => {
      if (!vendorMappings[row.market_id]) {
        vendorMappings[row.market_id] = {};
      }
      if (!vendorMappings[row.market_id][row.service_field]) {
        vendorMappings[row.market_id][row.service_field] = {};
      }
      vendorMappings[row.market_id][row.service_field][row.vendor_id] = {
        productName: row.product_name,
        vendorName: row.vendor_name
      };
    });
    
    // Process each market
    const marketScoreCards = [];
    
    for (const market of marketsResult.rows) {
      console.log(`\n🏬 Processing market: ${market.name} (ID: ${market.id})`);
      
      // Get latest market-level performance data for this market for the target month
      const performanceResult = await pool.query(`
        SELECT 
          pd.data
        FROM performance_data pd
        WHERE pd.market_id = $1
          AND pd.data_type = 'services'
          AND pd.store_id IS NULL
          AND pd.advisor_user_id IS NULL
          AND EXTRACT(YEAR FROM pd.upload_date) = $2
          AND EXTRACT(MONTH FROM pd.upload_date) = $3
        ORDER BY pd.upload_date DESC, pd.id DESC
        LIMIT 1
      `, [market.id, targetYear, targetMonth]);
      
      if (performanceResult.rows.length === 0) {
        console.log(`⚠️ No market-level performance data found for market ${market.name} in ${targetYear}-${targetMonth.toString().padStart(2, '0')}`);
        continue;
      }
      
      console.log(`📊 Found market-level performance data for ${market.name}`);
      
      // Use direct market data (no aggregation needed)
      const marketData = performanceResult.rows[0].data;
      
      const marketMetrics = {
        invoices: parseInt(marketData.invoices || 0),
        sales: parseFloat(marketData.sales || 0),
        gpSales: parseFloat(marketData.gpSales || 0),
        gpPercent: parseFloat(marketData.gpPercent || 0)
      };
      
      // Add average spend calculation
      marketMetrics.avgSpend = marketMetrics.invoices > 0 ? marketMetrics.sales / marketMetrics.invoices : 0;
      
      // Use the data directly (no aggregation)
      const aggregatedData = { ...marketData };
      const aggregatedOtherServices = marketData.otherServices || {};
      
      // Recalculate percentage fields from aggregated counts
      const potentialAlignments = aggregatedData.potentialAlignments || aggregatedOtherServices['Potential Alignments'] || 0;
      const potentialAlignmentsSold = aggregatedData.potentialAlignmentsSold || aggregatedOtherServices['Potential Alignments Sold'] || 0;
      
      if (potentialAlignments > 0) {
        const potentialAlignmentsPercent = Math.ceil((potentialAlignmentsSold / potentialAlignments) * 100);
        aggregatedData.potentialAlignmentsPercent = potentialAlignmentsPercent;
        aggregatedOtherServices['Potential Alignments %'] = potentialAlignmentsPercent;
      } else {
        aggregatedData.potentialAlignmentsPercent = 0;
        aggregatedOtherServices['Potential Alignments %'] = 0;
      }
      
      // Apply the same template field mappings as store/advisor scorecards
      const templateFieldMappings = {
        // Core metrics
        'invoices': { type: 'direct', field: 'invoices', label: 'Invoices' },
        'sales': { type: 'direct', field: 'sales', label: 'Sales' },
        'gpsales': { type: 'direct', field: 'gpSales', label: 'GP Sales' },
        'gppercent': { type: 'direct', field: 'gpPercent', label: 'GP %' },
        'avg.spend': { type: 'direct', field: 'avgSpend', label: 'Avg Spend' },
        
        // Service fields (same as store scorecards)
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
        
        // Percentage fields
        'potentialalignments%': { type: 'direct', field: 'potentialAlignmentsPercent', label: 'Potential Alignments %' },
        'potentialalignments': { type: 'direct', field: 'potentialAlignments', label: 'Potential Alignments' },
        'potentialalignmentssold': { type: 'direct', field: 'potentialAlignmentsSold', label: 'Potential Alignments Sold' },
        'brakeflushtoservice%': { type: 'direct', field: 'brakeFlushToServicePercent', label: 'Brake Flush to Service %' },
        'tireprotection%': { type: 'direct', field: 'tireProtectionPercent', label: 'Tire Protection %' }
      };
      
      // Convert services using template mappings
      const services = {};
      const vendorMapping = vendorMappings[market.id] || {};
      
      Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
        if (mapping.type === 'direct') {
          let value = aggregatedData[mapping.field] || 0;
          
          // Apply vendor branding if available
          if (vendorMapping[templateKey]) {
            const vendors = Object.values(vendorMapping[templateKey]);
            if (vendors.length > 0) {
              services[vendors[0].productName] = value;
            } else {
              services[mapping.label] = value;
            }
          } else {
            services[mapping.label] = value;
          }
        }
      });
      
      // Also include any fields from otherServices that might have been missed
      if (aggregatedOtherServices) {
        // Add all otherServices fields that aren't already in services
        const otherServiceMappings = {
          'Shocks & Struts': 'Shocks & Struts',
          'Tire Balance': 'Tire Balance',
          'Tire Rotation': 'Tire Rotation',
          'Spark Plug Replacement': 'Spark Plug Replacement',
          'Premium Alignments': 'Premium Alignments',
          'Belts Replacement': 'Belts Replacement',
          'Battery Service': 'Battery Service',
          'TPMS': 'TPMS',
          'Nitrogen': 'Nitrogen',
          'Fuel Filter': 'Fuel Filter',
          'Timing Belt': 'Timing Belt',
          'Hose Replacement': 'Hose Replacement',
          'Synthetic Oil Change': 'Synthetic Oil Change',
          'Transfer Case Service': 'Transfer Case Service',
          'Climate Control Service': 'Climate Control Service',
          'Engine Performance Service': 'Engine Performance Service',
          'Synthetic Blend Oil Change': 'Synthetic Blend Oil Change',
          'Complete Vehicle Inspection': 'Complete Vehicle Inspection',
          'Headlight Restoration Service': 'Headlight Restoration Service',
          'Brake Flush to Service %': 'Brake Flush to Service %',
          'Tire Protection %': 'Tire Protection %'
        };
        
        // Add each otherService field if it exists and isn't already in services
        Object.entries(otherServiceMappings).forEach(([sourceKey, targetKey]) => {
          if (aggregatedOtherServices[sourceKey] !== undefined && !services[targetKey]) {
            services[targetKey] = aggregatedOtherServices[sourceKey];
          }
        });
      }
      
      // Get goals for this market (if any)
      const goalsResult = await pool.query(`
        SELECT metric_name as service_key, target_value, period_type, effective_date
        FROM goals 
        WHERE market_id = $1 AND store_id IS NULL AND advisor_user_id IS NULL
        ORDER BY effective_date DESC
      `, [market.id]);
      
      const goals = {};
      goalsResult.rows.forEach(goal => {
        goals[goal.service_key] = {
          target: goal.target_value,
          periodType: goal.period_type,
          effectiveDate: goal.effective_date
        };
      });
      
      marketScoreCards.push({
        marketId: market.id,
        marketName: market.name,
        description: market.description,
        metrics: marketMetrics,
        services,
        goals,
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`✅ Market ${market.name}: ${marketMetrics.invoices} invoices, $${marketMetrics.sales} sales`);
    }
    
    console.log(`🏬 Processed ${marketScoreCards.length} markets`);
    
    res.json({
      period: {
        year: targetYear,
        month: targetMonth
      },
      markets: marketScoreCards,
      totalMarkets: marketScoreCards.length,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting market scorecards:', error);
    res.status(500).json({ message: 'Failed to get market scorecards' });
  }
});

// Store-level scorecard endpoint for validation middleware
router.get('/store/:storeId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId } = req.params;
    const { mtdMonth, mtdYear } = req.query;
    
    console.log(`📊 Getting store scorecard for store ${storeId}`);
    
    // Get store information
    const storeResult = await pool.query(`
      SELECT s.*, m.name as market_name, m.id as market_id
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE s.id = $1
    `, [storeId]);
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    const store = storeResult.rows[0];
    
    // Get all advisors in this store
    const advisorsResult = await pool.query(`
      SELECT DISTINCT u.id, u.first_name, u.last_name
      FROM users u
      JOIN user_store_assignments usa ON u.id::text = usa.user_id
      WHERE usa.store_id = $1 AND u.role = 'advisor'
    `, [storeId]);
    
    // Get performance data for the store
    let performanceQuery = `
      SELECT 
        SUM((data->>'sales')::numeric) as total_sales,
        SUM((data->>'gpSales')::numeric) as total_gp_sales,
        SUM((data->>'invoices')::numeric) as total_invoices,
        SUM((data->>'alignments')::numeric) as total_alignments,
        SUM((data->>'oilChange')::numeric) as total_oil_changes,
        SUM((data->>'retailTires')::numeric) as total_retail_tires,
        SUM((data->>'brakeService')::numeric) as total_brake_services
      FROM performance_data 
      WHERE store_id = $1::text
        AND data_type = 'services'
    `;
    
    const queryParams = [storeId];
    
    if (mtdMonth && mtdYear) {
      performanceQuery += ` AND EXTRACT(YEAR FROM upload_date) = $2 AND EXTRACT(MONTH FROM upload_date) = $3`;
      queryParams.push(parseInt(mtdYear), parseInt(mtdMonth));
    }
    
    const performanceResult = await pool.query(performanceQuery, queryParams);
    const performanceData = performanceResult.rows[0] || {};
    
    // Aggregate store-level metrics
    const storeMetrics = {
      totalSales: parseFloat(performanceData.total_sales) || 0,
      totalGpSales: parseFloat(performanceData.total_gp_sales) || 0,
      totalInvoices: parseInt(performanceData.total_invoices) || 0,
      totalAlignments: parseInt(performanceData.total_alignments) || 0,
      totalOilChanges: parseInt(performanceData.total_oil_changes) || 0,
      totalRetailTires: parseInt(performanceData.total_retail_tires) || 0,
      totalBrakeServices: parseInt(performanceData.total_brake_services) || 0,
      advisorCount: advisorsResult.rows.length,
      storeName: store.name,
      marketName: store.market_name
    };
    
    res.json({
      storeId: parseInt(storeId),
      period: { mtdMonth, mtdYear },
      metrics: storeMetrics,
      advisors: advisorsResult.rows,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Store scorecard error:', error);
    res.status(500).json({ message: 'Error generating store scorecard', error: error.message });
  }
});

// Market-level scorecard endpoint for validation middleware
router.get('/market/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    const { mtdMonth, mtdYear } = req.query;
    
    console.log(`📊 Getting market scorecard for market ${marketId}`);
    
    // Get market information
    const marketResult = await pool.query(`
      SELECT * FROM markets WHERE id = $1
    `, [marketId]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    const market = marketResult.rows[0];
    
    // Get all stores in this market
    const storesResult = await pool.query(`
      SELECT id, name FROM stores WHERE market_id = $1
    `, [marketId]);
    
    // Get all advisors in this market
    const advisorsResult = await pool.query(`
      SELECT DISTINCT u.id, u.first_name, u.last_name, s.name as store_name
      FROM users u
      JOIN user_market_assignments uma ON u.id::text = uma.user_id
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      WHERE uma.market_id = $1 AND u.role = 'advisor'
    `, [marketId]);
    
    // Aggregate market-level metrics
    const marketMetrics = {
      totalSales: 0,
      totalGpSales: 0,
      totalInvoices: 0,
      storeCount: storesResult.rows.length,
      advisorCount: advisorsResult.rows.length,
      marketName: market.name
    };
    
    res.json({
      marketId: parseInt(marketId),
      period: { mtdMonth, mtdYear },
      metrics: marketMetrics,
      stores: storesResult.rows,
      advisors: advisorsResult.rows,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Market scorecard error:', error);
    res.status(500).json({ message: 'Error generating market scorecard', error: error.message });
  }
});

// Store rankings endpoint for AI queries
router.get('/rankings/stores', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { metric = 'alignments', mtdMonth, mtdYear, limit = 10 } = req.query;
    
    console.log(`📊 Getting store rankings by ${metric} for ${mtdMonth}/${mtdYear} (using LATEST MTD upload per store)`);
    
    // Build the query based on the requested metric
    // NOTE: Each spreadsheet upload is a Month-To-Date (MTD) snapshot
    // We need to use ONLY the LATEST upload per store, not sum multiple uploads
    const metricField = {
      'alignments': "(latest_data.data->>'alignments')::numeric",
      'oilChange': "(latest_data.data->>'oilChange')::numeric",
      'sales': "(latest_data.data->>'sales')::numeric",
      'invoices': "(latest_data.data->>'invoices')::numeric",
      'retailTires': "(latest_data.data->>'retailTires')::numeric",
      'brakeService': "(latest_data.data->>'brakeService')::numeric"
    };
    
    if (!metricField[metric]) {
      return res.status(400).json({ message: `Invalid metric: ${metric}` });
    }
    
    // Build query that gets ONLY the latest MTD upload per store
    let query = `
      WITH latest_uploads AS (
        SELECT 
          pd.store_id,
          pd.data,
          pd.advisor_user_id,
          pd.upload_date,
          ROW_NUMBER() OVER (
            PARTITION BY pd.store_id 
            ORDER BY pd.upload_date DESC, pd.id DESC
          ) as rn
        FROM performance_data pd
        WHERE pd.data_type = 'services'
          AND pd.advisor_user_id IS NULL
    `;
    
    const queryParams = [];
    
    if (mtdMonth && mtdYear) {
      query += ` AND EXTRACT(YEAR FROM pd.upload_date) = $1 AND EXTRACT(MONTH FROM pd.upload_date) = $2`;
      queryParams.push(parseInt(mtdYear), parseInt(mtdMonth));
    }
    
    query += `
      ),
      latest_data AS (
        SELECT *
        FROM latest_uploads
        WHERE rn = 1
      )
      SELECT 
        s.id as store_id,
        s.name as store_name,
        m.name as market_name,
        ${metricField[metric]} as metric_value,
        1 as advisor_count
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      LEFT JOIN latest_data ON latest_data.store_id::integer = s.id
      WHERE latest_data.data IS NOT NULL
        AND ${metricField[metric]} > 0
      ORDER BY metric_value DESC
      LIMIT ${parseInt(limit)}`;
    
    const result = await pool.query(query, queryParams);
    
    // Format the response
    const rankings = result.rows.map((row, index) => ({
      rank: index + 1,
      storeId: row.store_id,
      storeName: row.store_name,
      marketName: row.market_name,
      metricValue: parseFloat(row.metric_value) || 0,
      advisorCount: parseInt(row.advisor_count) || 0
    }));
    
    res.json({
      metric: metric,
      period: { month: mtdMonth, year: mtdYear },
      rankings: rankings,
      totalStores: rankings.length,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Store rankings error:', error);
    res.status(500).json({ message: 'Error generating store rankings', error: error.message });
  }
});

module.exports = router;