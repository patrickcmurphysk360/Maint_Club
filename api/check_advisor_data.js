const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'admin',
  password: 'ducks2020'
});

async function checkAdvisorData() {
  try {
    console.log('=== CHECKING ADVISOR DATA AFTER DOCKER RESTART ===\n');
    
    // Check advisor mappings
    const mappingsResult = await pool.query('SELECT COUNT(*) FROM advisor_mappings');
    console.log('1. Advisor Mappings Count:', mappingsResult.rows[0].count);
    
    if (parseInt(mappingsResult.rows[0].count) === 0) {
      console.log('❌ ISSUE: No advisor mappings found!');
    } else {
      const mappingsDetails = await pool.query(`
        SELECT am.id, am.spreadsheet_name, am.user_id, am.market_id, am.store_id, am.is_active
        FROM advisor_mappings am 
        LIMIT 5
      `);
      console.log('   Sample mappings:');
      console.table(mappingsDetails.rows);
    }
    
    // Check performance data 
    const perfResult = await pool.query(`
      SELECT COUNT(*) as total_records,
             COUNT(DISTINCT advisor_user_id) as unique_advisors,
             MIN(upload_date) as earliest_date,
             MAX(upload_date) as latest_date
      FROM performance_data
    `);
    console.log('\n2. Performance Data:');
    console.table(perfResult.rows);
    
    // Check users
    const usersResult = await pool.query(`
      SELECT COUNT(*) as total_users,
             COUNT(*) FILTER (WHERE role = 'advisor') as advisor_users
      FROM users
    `);
    console.log('\n3. Users:');
    console.table(usersResult.rows);
    
    // Check if scorecard API can get data for a specific advisor
    if (parseInt(mappingsResult.rows[0].count) > 0) {
      const sampleMapping = await pool.query(`
        SELECT user_id FROM advisor_mappings LIMIT 1
      `);
      const userId = sampleMapping.rows[0].user_id;
      
      console.log(`\n4. Testing scorecard data for user_id ${userId}:`);
      
      const scorecardResult = await pool.query(`
        SELECT 
          pd.upload_date,
          pd.data->>'invoices' as invoices,
          pd.data->>'sales' as sales,
          pd.data->>'employeeName' as employee_name
        FROM performance_data pd
        WHERE pd.advisor_user_id = $1
          AND pd.data_type = 'services'
        ORDER BY pd.upload_date DESC
        LIMIT 3
      `, [userId]);
      
      if (scorecardResult.rows.length > 0) {
        console.log('✅ Performance data found for this advisor:');
        console.table(scorecardResult.rows);
      } else {
        console.log('❌ No performance data found for this advisor');
      }
    }
    
  } catch (error) {
    console.error('Error checking advisor data:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdvisorData();