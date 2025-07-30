const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'admin',
  password: 'ducks2020'
});

async function checkUserMappings() {
  try {
    console.log('=== CHECKING USER TO ADVISOR MAPPINGS ===\n');
    
    // Check how advisor_mappings links to users
    const mappingsResult = await pool.query(`
      SELECT 
        am.id,
        am.spreadsheet_name,
        am.user_id,
        u.id as actual_user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        am.market_id,
        am.store_id
      FROM advisor_mappings am
      LEFT JOIN users u ON u.id = am.user_id
      WHERE u.role = 'advisor'
      LIMIT 10
    `);
    
    console.log('Advisor Mappings linked to Users:');
    console.table(mappingsResult.rows);
    
    // Check if there are advisor users without mappings
    const unmappedResult = await pool.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM users u
      LEFT JOIN advisor_mappings am ON am.user_id = u.id
      WHERE u.role = 'advisor' 
        AND am.id IS NULL
    `);
    
    console.log('\nAdvisor users WITHOUT mappings:');
    if (unmappedResult.rows.length > 0) {
      console.table(unmappedResult.rows);
    } else {
      console.log('✅ All advisor users have mappings');
    }
    
    // Check what the API query returns
    console.log('\n=== SIMULATING API QUERY ===');
    const apiResult = await pool.query(`
      SELECT DISTINCT
        u.id, 
        u.first_name as "firstName", 
        u.last_name as "lastName",
        u.email,
        u.role,
        s.name as store_name, 
        s.id as store_id,
        m.name as market_name, 
        m.id as market_id
      FROM users u
      LEFT JOIN advisor_mappings am ON u.id = am.user_id AND am.is_active = true
      LEFT JOIN stores s ON am.store_id = s.id
      LEFT JOIN markets m ON am.market_id = m.id
      WHERE u.role = 'advisor'
      LIMIT 5
    `);
    
    console.log('API Query Result (first 5 advisors):');
    console.table(apiResult.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserMappings();