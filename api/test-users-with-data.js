// Test the new users/with-performance-data endpoint
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function testUsersWithPerformanceData() {
  try {
    console.log('🔍 Testing users with performance data query...\n');
    
    // Test the exact query from the new endpoint
    const query = `
      SELECT DISTINCT
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.role, u.status, u.is_vendor as "isVendor", 
        u.created_at as "createdAt", u.mobile, u.vendor,
        s.name as store_name, s.id as store_id,
        m.name as market_name, m.id as market_id
      FROM users u
      INNER JOIN performance_data pd ON pd.advisor_user_id = u.id
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
      LEFT JOIN markets m ON uma.market_id::integer = m.id
      WHERE u.status = 'active' AND pd.data_type = 'services'
      ORDER BY u.first_name, u.last_name
    `;
    
    const result = await pool.query(query);
    
    console.log(`✅ Found ${result.rows.length} users with performance data:\n`);
    
    // Group by role to show the distribution
    const roleGroups = {};
    result.rows.forEach(row => {
      if (!roleGroups[row.role]) {
        roleGroups[row.role] = [];
      }
      roleGroups[row.role].push(row);
    });
    
    console.log('📊 Distribution by role:');
    Object.keys(roleGroups).forEach(role => {
      console.log(`  ${role}: ${roleGroups[role].length} users`);
      roleGroups[role].forEach(user => {
        console.log(`    - ${user.firstName} ${user.lastName} (${user.email})`);
      });
      console.log('');
    });
    
    // Verify we have the expected users
    const expectedUsers = [
      'John Blackerby', 'Mike Perkins', 'Christian Spencer', 
      'Jaime Robledo', 'Rummel Victor', 'Gerald Sheets'
    ];
    
    const foundUsers = result.rows.map(row => `${row.firstName} ${row.lastName}`);
    console.log('🔍 Checking for expected key users:');
    expectedUsers.forEach(name => {
      const found = foundUsers.some(found => found.toLowerCase().includes(name.toLowerCase()));
      console.log(`  ${found ? '✅' : '❌'} ${name}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    });
    
    console.log(`\n🎉 Summary: ${result.rows.length} total users with performance data across ${Object.keys(roleGroups).length} different roles`);
    console.log('✅ This should now display in the frontend scorecards!');
    
  } catch (error) {
    console.error('❌ Error testing users with performance data:', error);
  } finally {
    await pool.end();
  }
}

testUsersWithPerformanceData();