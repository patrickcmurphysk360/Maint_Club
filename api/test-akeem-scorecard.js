#!/usr/bin/env node

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'postgres',
  password: 'yourpassword'
});

async function testAkeemScorecard() {
  try {
    console.log('🔍 Testing Akeem Jackson\'s scorecard API response...\n');
    
    // 1. Find Akeem's user ID
    const mappingResult = await pool.query(`
      SELECT user_id, spreadsheet_name
      FROM advisor_mappings 
      WHERE LOWER(spreadsheet_name) LIKE '%akeem%' 
         OR LOWER(spreadsheet_name) LIKE '%jackson%'
      LIMIT 1
    `);
    
    if (mappingResult.rows.length === 0) {
      console.log('❌ Akeem Jackson not found in advisor_mappings');
      return;
    }
    
    const akeemUserId = mappingResult.rows[0].user_id;
    console.log(`✅ Found Akeem Jackson: ${mappingResult.rows[0].spreadsheet_name} (User ID: ${akeemUserId})`);
    
    // 2. Test the regular scorecard API (aggregated)
    console.log('\n📊 Testing regular scorecard API (aggregated across stores)...');
    await testRegularScorecard(akeemUserId, 2025, 7);
    
    // 3. Test the by-store API (individual store data)
    console.log('\n🏪 Testing by-store scorecard API...');
    await testByStoreScorecard(akeemUserId, 2025, 7);
    
  } catch (error) {
    console.error('❌ Error testing Akeem scorecard:', error);
  } finally {
    await pool.end();
  }
}

async function testRegularScorecard(userId, mtdYear, mtdMonth) {
  try {
    // Simulate the regular scorecard API call
    console.log(`Getting MTD data for ${mtdYear}-${mtdMonth.toString().padStart(2, '0')} for user ${userId}`);
    
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        pd.store_id,
        s.name as store_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id::text = s.id::text
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND EXTRACT(YEAR FROM pd.upload_date) = $2
        AND EXTRACT(MONTH FROM pd.upload_date) = $3
      ORDER BY pd.upload_date DESC
    `, [userId, mtdYear, mtdMonth]);
    
    console.log(`Found ${performanceResult.rows.length} performance records`);
    
    if (performanceResult.rows.length === 0) {
      console.log('❌ No performance data found for the specified period');
      return;
    }
    
    // Log each store's data
    performanceResult.rows.forEach((row, index) => {
      console.log(`\nStore ${index + 1}: ${row.store_name} (${row.store_id})`);
      console.log(`Upload Date: ${row.upload_date}`);
      const data = row.data;
      console.log(`Invoices: ${data.invoices || 0}`);
      console.log(`Sales: $${data.sales || 0}`);
      console.log(`GP Sales: $${data.gpSales || 0}`);
      console.log(`GP %: ${data.gpPercent || 0}%`);
      
      // Look for All Tires
      if (data.allTires !== undefined) {
        console.log(`All Tires: ${data.allTires}`);
      } else if (data.otherServices && data.otherServices['All Tires']) {
        console.log(`All Tires: ${data.otherServices['All Tires']}`);
      }
    });
    
    // Aggregate the data (same as API does)
    const metrics = { invoices: 0, sales: 0, gpSales: 0 };
    const aggregatedData = {};
    const aggregatedOtherServices = {};
    
    performanceResult.rows.forEach(row => {
      const data = row.data;
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      // Aggregate services
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number' && !['invoices', 'sales', 'gpSales', 'gpPercent'].includes(key)) {
          aggregatedData[key] = (aggregatedData[key] || 0) + data[key];
        }
      });
      
      if (data.otherServices) {
        Object.keys(data.otherServices).forEach(key => {
          const value = parseFloat(data.otherServices[key]);
          if (!isNaN(value)) {
            aggregatedOtherServices[key] = (aggregatedOtherServices[key] || 0) + value;
          }
        });
      }
    });
    
    metrics.gpPercent = metrics.sales > 0 ? (metrics.gpSales / metrics.sales) * 100 : 0;
    
    console.log(`\n📊 AGGREGATED TOTALS (All Stores):`);
    console.log(`Invoices: ${metrics.invoices}`);
    console.log(`Sales: $${metrics.sales}`);
    console.log(`GP Sales: $${metrics.gpSales}`);
    console.log(`GP %: ${metrics.gpPercent.toFixed(1)}%`);
    console.log(`Avg Spend: $${metrics.invoices > 0 ? (metrics.sales / metrics.invoices).toFixed(2) : 0}`);
    
    // Look for All Tires in aggregated data
    if (aggregatedData.allTires) {
      console.log(`All Tires: ${aggregatedData.allTires}`);
    } else if (aggregatedOtherServices['All Tires']) {
      console.log(`All Tires: ${aggregatedOtherServices['All Tires']}`);
    } else {
      console.log(`All Tires: Not found in aggregated data`);
    }
    
  } catch (error) {
    console.error('Error in regular scorecard test:', error);
  }
}

async function testByStoreScorecard(userId, mtdYear, mtdMonth) {
  try {
    // Simulate the by-store API call
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        pd.store_id,
        s.name as store_name,
        s.id as store_id_numeric,
        s.market_id,
        m.name as market_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id::text = s.id::text
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND EXTRACT(YEAR FROM pd.upload_date) = $2
        AND EXTRACT(MONTH FROM pd.upload_date) = $3
      ORDER BY pd.store_id, pd.upload_date DESC
    `, [userId, mtdYear, mtdMonth]);
    
    console.log(`Found ${performanceResult.rows.length} store-separated records`);
    
    // Group by store
    const storeData = new Map();
    
    performanceResult.rows.forEach(row => {
      const storeKey = row.store_id || 'unknown';
      const storeName = row.store_name || `Store ${storeKey}`;
      
      if (!storeData.has(storeKey)) {
        storeData.set(storeKey, {
          storeName,
          marketName: row.market_name,
          records: [],
          metrics: { invoices: 0, sales: 0, gpSales: 0 }
        });
      }
      
      const store = storeData.get(storeKey);
      store.records.push(row);
      
      const data = row.data;
      store.metrics.invoices += parseInt(data.invoices || 0);
      store.metrics.sales += parseFloat(data.sales || 0);
      store.metrics.gpSales += parseFloat(data.gpSales || 0);
    });
    
    // Display individual store data
    storeData.forEach((store, storeId) => {
      console.log(`\n🏪 ${store.storeName} (ID: ${storeId})`);
      console.log(`Market: ${store.marketName}`);
      console.log(`Records: ${store.records.length}`);
      
      store.metrics.gpPercent = store.metrics.sales > 0 ? (store.metrics.gpSales / store.metrics.sales) * 100 : 0;
      
      console.log(`Invoices: ${store.metrics.invoices}`);
      console.log(`Sales: $${store.metrics.sales}`);
      console.log(`GP Sales: $${store.metrics.gpSales}`);
      console.log(`GP %: ${store.metrics.gpPercent.toFixed(1)}%`);
      console.log(`Avg Spend: $${store.metrics.invoices > 0 ? (store.metrics.sales / store.metrics.invoices).toFixed(2) : 0}`);
      
      // Check for Atlanta specifically
      if (store.storeName.toLowerCase().includes('atlanta')) {
        console.log(`\n🎯 ATLANTA COMPARISON:`);
        console.log(`Expected: Invoices: 216, Sales: $64,779, GP Sales: $27,656, GP %: 42.7%, All Tires: 191`);
        console.log(`Actual:   Invoices: ${store.metrics.invoices}, Sales: $${store.metrics.sales}, GP Sales: $${store.metrics.gpSales}, GP %: ${store.metrics.gpPercent.toFixed(1)}%`);
        
        // Look for All Tires in this store's data
        let allTires = 0;
        store.records.forEach(record => {
          const data = record.data;
          if (data.allTires) {
            allTires += data.allTires;
          } else if (data.otherServices && data.otherServices['All Tires']) {
            allTires += data.otherServices['All Tires'];
          }
        });
        console.log(`All Tires: ${allTires}`);
        
        // Check accuracy
        const matches = {
          invoices: Math.abs(store.metrics.invoices - 216) <= 1,
          sales: Math.abs(store.metrics.sales - 64779) <= 100,
          gpSales: Math.abs(store.metrics.gpSales - 27656) <= 100,
          gpPercent: Math.abs(store.metrics.gpPercent - 42.7) <= 0.5,
          allTires: Math.abs(allTires - 191) <= 1
        };
        
        console.log(`\n✅ Accuracy Check:`);
        Object.entries(matches).forEach(([metric, isMatch]) => {
          console.log(`${metric}: ${isMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error in by-store scorecard test:', error);
  }
}

// Run the test
testAkeemScorecard();