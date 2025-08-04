const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testAkeenJulyStores() {
  console.log('🔍 Testing Akeen Jackson Store History - July 2025\n');
  
  try {
    // Find Akeen Jackson's user ID
    const userResult = await pool.query(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Akeen Jackson not found');
      return;
    }
    
    const akeenId = userResult.rows[0].id;
    console.log(`Found Akeen Jackson (ID: ${akeenId})\n`);
    
    // Check performance_data for July 2025 to see which stores he worked at
    console.log('1. Checking performance_data for July 2025 store assignments...');
    const performanceResult = await pool.query(`
      SELECT DISTINCT
        pd.upload_date,
        pd.store_id,
        s.name as store_name,
        pd.data->>'storeName' as data_store_name,
        pd.data->>'storeId' as data_store_id
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      WHERE pd.advisor_user_id = $1
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 7
      ORDER BY pd.upload_date
    `, [akeenId]);
    
    console.log(`Found ${performanceResult.rows.length} performance records for July 2025:`);
    performanceResult.rows.forEach((record, index) => {
      const date = new Date(record.upload_date).toLocaleDateString();
      const storeName = record.store_name || record.data_store_name || 'Unknown';
      const storeId = record.store_id || record.data_store_id || 'Unknown';
      console.log(`  ${index + 1}. ${date}: ${storeName} (Store ID: ${storeId})`);
    });
    
    // Get unique stores from July
    const uniqueStores = [...new Set(performanceResult.rows.map(r => 
      r.store_name || r.data_store_name || 'Unknown'
    ))];
    console.log(`\nUnique stores worked at in July 2025: ${uniqueStores.join(', ')}`);
    
    // Check user_store_assignments table for historical assignments
    console.log('\n2. Checking user_store_assignments for historical data...');
    const assignmentResult = await pool.query(`
      SELECT 
        usa.store_id,
        s.name as store_name,
        usa.assigned_at,
        usa.removed_at
      FROM user_store_assignments usa
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      WHERE usa.user_id = $1::text
      ORDER BY usa.assigned_at DESC
    `, [akeenId]);
    
    console.log(`Found ${assignmentResult.rows.length} store assignment records:`);
    assignmentResult.rows.forEach((record, index) => {
      const assignedDate = record.assigned_at ? new Date(record.assigned_at).toLocaleDateString() : 'Unknown';
      const removedDate = record.removed_at ? new Date(record.removed_at).toLocaleDateString() : 'Current';
      console.log(`  ${index + 1}. ${record.store_name}: ${assignedDate} - ${removedDate}`);
    });
    
    // Check if AI would detect this as a store history query
    console.log('\n3. Testing AI query detection...');
    const query = "what stores did akeen jackson work at during july 2025";
    const lowerQuery = query.toLowerCase();
    
    // Test patterns that should detect this as organizational/historical query
    const storeHistoryPattern = /(?:what\s+stores?|which\s+stores?|where\s+(?:did|has))\s+.*?([a-zA-Z\s]+?)\s+(?:work|worked|been)/i;
    const match = lowerQuery.match(storeHistoryPattern);
    console.log(`Store history pattern match: ${match ? `"${match[1]}"` : 'NO MATCH'}`);
    
    // What the AI should respond with
    console.log('\n🎯 EXPECTED AI RESPONSE:');
    console.log('**AKEEN JACKSON - JULY 2025 STORE HISTORY**');
    if (uniqueStores.length > 0 && uniqueStores[0] !== 'Unknown') {
      uniqueStores.forEach(store => {
        console.log(`• Worked at: ${store}`);
      });
    } else {
      console.log('• Store assignment data not available for July 2025');
      console.log('• Recommend checking user_store_assignments table for historical assignments');
    }
    
  } catch (error) {
    console.error('❌ Error testing Akeen July stores:', error);
  } finally {
    await pool.end();
  }
}

testAkeenJulyStores();