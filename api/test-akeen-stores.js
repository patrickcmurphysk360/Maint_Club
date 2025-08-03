const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testAkeenStores() {
  const aiDataService = new AIDataService(pool);
  
  console.log('🔍 Testing: What stores has Akeen worked in?\n');
  
  // First, find Akeen in the database
  console.log('1. Searching for Akeen...');
  const akeenSearch = await aiDataService.searchUsers('Akeen', 'name');
  console.log(`Found ${akeenSearch.length} users named Akeen:`);
  akeenSearch.forEach(user => {
    console.log(`  - ${user.first_name} ${user.last_name} (${user.role}) at ${user.store_name || 'No store'}`);
  });
  console.log('');
  
  // Check if Akeen has worked at multiple stores (historical data)
  if (akeenSearch.length > 0) {
    const akeenId = akeenSearch[0].id;
    console.log('2. Checking store assignment history...');
    
    // Query for all store assignments (current and past)
    const storeHistory = await pool.query(`
      SELECT DISTINCT
        s.name as store_name,
        s.city,
        s.state,
        usa.assigned_at,
        m.name as market_name
      FROM user_store_assignments usa
      JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE usa.user_id = $1::text
      ORDER BY usa.assigned_at DESC
    `, [akeenId.toString()]);
    
    console.log(`Found ${storeHistory.rows.length} store assignments:`);
    storeHistory.rows.forEach(assignment => {
      const assignedDate = new Date(assignment.assigned_at).toLocaleDateString();
      console.log(`  - ${assignment.store_name} (${assignment.city}, ${assignment.state}) - ${assignment.market_name} - Assigned: ${assignedDate}`);
    });
    console.log('');
    
    // Check performance data to see if there are records from multiple stores
    console.log('3. Checking performance data across stores...');
    const perfData = await pool.query(`
      SELECT DISTINCT
        pd.store_id,
        s.name as store_name,
        COUNT(*) as record_count,
        MIN(pd.upload_date) as first_record,
        MAX(pd.upload_date) as last_record
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      WHERE pd.advisor_user_id = $1
      GROUP BY pd.store_id, s.name
      ORDER BY MIN(pd.upload_date)
    `, [akeenId]);
    
    console.log(`Performance data across ${perfData.rows.length} stores:`);
    perfData.rows.forEach(perf => {
      const firstDate = new Date(perf.first_record).toLocaleDateString();
      const lastDate = new Date(perf.last_record).toLocaleDateString();
      console.log(`  - ${perf.store_name || 'Unknown Store'}: ${perf.record_count} records (${firstDate} to ${lastDate})`);
    });
  }
  
  console.log('\n4. Testing organizational query analysis...');
  const orgResult = await aiDataService.analyzeOrganizationalQuery('what stores has akeen worked in', 1);
  console.log(`Organizational query detected: ${orgResult ? 'Yes' : 'No'}`);
  if (orgResult) {
    console.log(`Found ${orgResult.length} results from query analysis`);
  }
  
  await pool.end();
}

testAkeenStores();