/**
 * Test Cody Lanier User Lookup
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testCodyLanierLookup() {
  console.log('🔍 Looking up Cody Lanier in database...');
  
  try {
    // Search for Cody Lanier variations
    const result = await pool.query(`
      SELECT id, first_name, last_name, email, role, status
      FROM users 
      WHERE (LOWER(first_name) LIKE LOWER('%cody%') AND LOWER(last_name) LIKE LOWER('%lanier%'))
         OR (LOWER(first_name || ' ' || last_name) LIKE LOWER('%cody lanier%'))
      ORDER BY id
    `);
    
    console.log(`📊 Found ${result.rows.length} matching users:`);
    result.rows.forEach(user => {
      console.log(`- ID: ${user.id}, Name: ${user.first_name} ${user.last_name}, Email: ${user.email}, Role: ${user.role}, Status: ${user.status}`);
    });
    
    if (result.rows.length > 0) {
      const userId = result.rows[0].id;
      console.log(`\n🎯 Testing with user ID: ${userId}`);
      
      // Check store assignments
      const storeResult = await pool.query(`
        SELECT s.name as store_name, s.id as store_id
        FROM user_store_assignments usa
        JOIN stores s ON usa.store_id::integer = s.id
        WHERE usa.user_id = $1
      `, [userId.toString()]);
      
      console.log(`📍 Store assignments: ${storeResult.rows.length}`);
      storeResult.rows.forEach(store => {
        console.log(`  - ${store.store_name} (ID: ${store.store_id})`);
      });
      
      // Check performance data
      const perfResult = await pool.query(`
        SELECT COUNT(*) as record_count, 
               MIN(upload_date) as first_record,
               MAX(upload_date) as last_record
        FROM performance_data 
        WHERE advisor_user_id = $1
      `, [userId]);
      
      const perfData = perfResult.rows[0];
      console.log(`📈 Performance records: ${perfData.record_count}`);
      if (perfData.record_count > 0) {
        console.log(`  - Date range: ${perfData.first_record} to ${perfData.last_record}`);
      }
      
      return userId;
    } else {
      console.log('❌ No users found matching "Cody Lanier"');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return null;
  } finally {
    await pool.end();
  }
}

testCodyLanierLookup().catch(console.error);