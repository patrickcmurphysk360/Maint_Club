const express = require('express');
const router = express.Router();

// Get compiled performance data in JSON format
router.get('/performance-json', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId, startDate, endDate } = req.query;
    
    if (!marketId) {
      return res.status(400).json({ message: 'Market ID is required' });
    }
    
    // Get market info
    const marketResult = await pool.query(
      'SELECT name FROM markets WHERE id = $1',
      [marketId]
    );
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    const marketName = marketResult.rows[0].name;
    
    // Get stores in the market
    const storesResult = await pool.query(`
      SELECT DISTINCT 
        s.id,
        s.name
      FROM stores s
      WHERE s.market_id = $1
      ORDER BY s.name
    `, [marketId]);
    
    const stores = [];
    
    for (const store of storesResult.rows) {
      // Get operations data for the store
      const operationsResult = await pool.query(`
        SELECT 
          pd.data
        FROM performance_data pd
        WHERE pd.store_id = $1
          AND pd.data_type = 'operations'
          AND pd.upload_date BETWEEN $2 AND $3
        ORDER BY pd.upload_date DESC
        LIMIT 1
      `, [store.id, startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]]);
      
      let operations = {};
      if (operationsResult.rows.length > 0) {
        const data = operationsResult.rows[0].data;
        operations = {
          sales: parseFloat(data.sales || 0),
          invoices: parseInt(data.invoices || 0),
          gpPercent: data.gpPercent || "0%",
          laborHours: parseFloat(data.laborHours || 0),
          effectiveLaborRate: parseFloat(data.effectiveLaborRate || 0),
          tireUnits: parseInt(data.tireUnits || 0),
          averageRO: parseFloat(data.averageRO || 0)
        };
      }
      
      // Get advisors for the store
      const advisorsResult = await pool.query(`
        SELECT DISTINCT
          u.id,
          u.first_name || ' ' || u.last_name as name,
          am.spreadsheet_name
        FROM users u
        JOIN advisor_mappings am ON am.user_id = u.id
        WHERE am.store_id = $1 AND am.is_active = true
        ORDER BY u.first_name, u.last_name
      `, [store.id]);
      
      const advisors = [];
      
      for (const advisor of advisorsResult.rows) {
        // Get advisor performance data
        const advisorDataResult = await pool.query(`
          SELECT 
            pd.data
          FROM performance_data pd
          WHERE pd.advisor_user_id = $1
            AND pd.data_type = 'services'
            AND pd.upload_date BETWEEN $2 AND $3
        `, [advisor.id, startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]]);
        
        // Aggregate advisor data
        let scorecard = {
          invoices: 0,
          sales: 0,
          gpSales: 0
        };
        
        const serviceFields = [
          'premiumOilChange', 'fuelAdditive', 'engineFlush', 'filters',
          'alignments', 'brakeService', 'brakeFlush'
        ];
        
        serviceFields.forEach(field => {
          scorecard[field] = 0;
        });
        
        advisorDataResult.rows.forEach(row => {
          const data = row.data;
          scorecard.invoices += parseInt(data.invoices || 0);
          scorecard.sales += parseFloat(data.sales || 0);
          scorecard.gpSales += parseFloat(data.gpSales || 0);
          
          serviceFields.forEach(field => {
            scorecard[field] += parseInt(data[field] || 0);
          });
        });
        
        // Get vendor mappings for this advisor's services
        const vendorMappingsResult = await pool.query(`
          SELECT DISTINCT
            vpm.service_field,
            vpm.product_name
          FROM advisor_mappings am
          JOIN market_tags mt ON mt.market_id = am.market_id
          JOIN vendor_product_mappings vpm ON vpm.vendor_id = mt.tag_id
          WHERE am.user_id = $1 AND am.is_active = true
        `, [advisor.id]);
        
        // Apply vendor mappings
        const mappedScorecard = {};
        Object.entries(scorecard).forEach(([key, value]) => {
          const fieldMapping = {
            'invoices': 'Invoices',
            'sales': 'Sales',
            'gpSales': 'GP Sales',
            'premiumOilChange': 'Premium Oil Change',
            'fuelAdditive': 'Fuel Additive',
            'engineFlush': 'Engine Flush',
            'filters': 'Filters',
            'alignments': 'Alignments',
            'brakeService': 'Brake Service',
            'brakeFlush': 'Brake Flush'
          };
          
          const serviceName = fieldMapping[key] || key;
          let displayName = serviceName;
          
          // Check for vendor mapping
          const mapping = vendorMappingsResult.rows.find(m => m.service_field === serviceName);
          if (mapping) {
            displayName = mapping.product_name;
          }
          
          mappedScorecard[displayName] = value;
        });
        
        // Get goals for this advisor
        const goalsResult = await pool.query(`
          SELECT 
            metric_name,
            target_value
          FROM goals
          WHERE goal_type = 'advisor'
            AND advisor_user_id = $1
            AND effective_date <= CURRENT_DATE
          ORDER BY effective_date DESC
        `, [advisor.id]);
        
        const goals = {};
        goalsResult.rows.forEach(row => {
          goals[row.metric_name] = parseFloat(row.target_value);
        });
        
        // Get coaching messages
        const coachingResult = await pool.query(`
          SELECT 
            u.first_name || ' ' || u.last_name as author,
            cm.message,
            cm.created_at as timestamp
          FROM coaching_messages cm
          JOIN users u ON cm.author_user_id = u.id
          WHERE cm.advisor_user_id = $1
          ORDER BY cm.created_at DESC
          LIMIT 10
        `, [advisor.id]);
        
        const coaching = coachingResult.rows.map(row => ({
          author: row.author,
          timestamp: row.timestamp,
          message: row.message
        }));
        
        advisors.push({
          userId: advisor.id,
          name: advisor.name,
          scorecard: mappedScorecard,
          goals: goals,
          coaching: coaching
        });
      }
      
      stores.push({
        name: store.name,
        operations: operations,
        advisors: advisors
      });
    }
    
    // Build final JSON structure
    const output = {
      market: marketName,
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate || '2024-01-01',
        endDate: endDate || new Date().toISOString().split('T')[0]
      },
      stores: stores
    };
    
    res.json(output);
    
  } catch (error) {
    console.error('Error generating performance JSON:', error);
    res.status(500).json({ message: 'Failed to generate performance JSON' });
  }
});

// Export raw data for external systems
router.get('/raw-data', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { dataType, startDate, endDate } = req.query;
    
    if (!dataType || !['services', 'operations'].includes(dataType)) {
      return res.status(400).json({ message: 'Valid data type (services or operations) is required' });
    }
    
    // Get raw performance data
    const result = await pool.query(`
      SELECT 
        pd.id,
        pd.upload_date as "uploadDate",
        pd.data_type as "dataType",
        m.name as "marketName",
        s.name as "storeName",
        CASE 
          WHEN pd.advisor_user_id IS NOT NULL 
          THEN u.first_name || ' ' || u.last_name 
          ELSE NULL 
        END as "advisorName",
        pd.data
      FROM performance_data pd
      LEFT JOIN markets m ON pd.market_id = m.id
      LEFT JOIN stores s ON pd.store_id = s.id
      LEFT JOIN users u ON pd.advisor_user_id = u.id
      WHERE pd.data_type = $1
        AND pd.upload_date BETWEEN $2 AND $3
      ORDER BY pd.upload_date DESC, m.name, s.name
    `, [
      dataType, 
      startDate || '2024-01-01', 
      endDate || new Date().toISOString().split('T')[0]
    ]);
    
    res.json({
      dataType: dataType,
      period: {
        startDate: startDate || '2024-01-01',
        endDate: endDate || new Date().toISOString().split('T')[0]
      },
      records: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error exporting raw data:', error);
    res.status(500).json({ message: 'Failed to export raw data' });
  }
});

module.exports = router;