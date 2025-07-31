// Test scorecard API directly
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function testScorecardQuery() {
  try {
    console.log('🔍 Testing scorecard query for user 243 (John Blackerby)...\n');
    
    const userId = 243;
    const startDate = '2024-01-01';
    const endDate = '2025-07-31';
    
    // Test the performance data query
    console.log('1. Testing performance data query...');
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        (pd.data->>'employeeName') as employee_name,
        (pd.data->>'sales')::integer as sales
      FROM performance_data pd
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date BETWEEN $2 AND $3
      ORDER BY pd.upload_date DESC
    `, [userId, startDate, endDate]);
    
    console.log(`✅ Found ${performanceResult.rows.length} performance records`);
    performanceResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.upload_date.toISOString().split('T')[0]} - ${row.employee_name} - Sales: $${row.sales}`);
    });
    
    // Test the vendor mappings query
    console.log('\n2. Testing vendor mappings query...');
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
    
    console.log(`✅ Found ${vendorMappingsResult.rows.length} vendor mappings`);
    vendorMappingsResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.service_field} -> ${row.product_name} (${row.vendor_name})`);
    });
    
    // Test if there are any other issues
    console.log('\n3. Testing data structure...');
    if (performanceResult.rows.length > 0) {
      const firstRecord = performanceResult.rows[0];
      console.log('Sample data structure:');
      console.log('  - employeeName:', firstRecord.data.employeeName);
      console.log('  - sales:', firstRecord.data.sales);
      console.log('  - oilChange:', firstRecord.data.oilChange);
      console.log('  - premiumOilChange:', firstRecord.data.premiumOilChange);
      console.log('  - storeName:', firstRecord.data.storeName);
    }
    
    console.log('\n🔍 Summary:');
    console.log(`  - Performance records: ${performanceResult.rows.length}`);
    console.log(`  - Vendor mappings: ${vendorMappingsResult.rows.length}`);
    console.log('  - Date range:', startDate, 'to', endDate);
    
    if (performanceResult.rows.length > 0) {
      console.log('\n✅ Data should be visible in scorecards!');
      console.log('🔍 If scorecards are still empty, the issue is in the frontend display logic.');
    } else {
      console.log('\n❌ No data found - this explains why scorecards are empty.');
    }
    
  } catch (error) {
    console.error('❌ Error testing scorecard:', error);
  } finally {
    await pool.end();
  }
}

testScorecardQuery();