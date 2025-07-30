const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'admin',
  password: 'ducks2020'
});

async function checkStores() {
  try {
    // Check available stores
    const storesResult = await pool.query('SELECT * FROM stores ORDER BY id');
    console.log('Available stores:');
    console.table(storesResult.rows);
    
    // Check available markets
    const marketsResult = await pool.query('SELECT * FROM markets ORDER BY id');
    console.log('\nAvailable markets:');
    console.table(marketsResult.rows);
    
    // Check existing advisor mappings
    const mappingsResult = await pool.query('SELECT COUNT(*) FROM advisor_mappings');
    console.log('\nExisting advisor mappings:', mappingsResult.rows[0].count);
    
    // Check performance data samples
    const perfResult = await pool.query(`
      SELECT DISTINCT 
        advisor_user_id, 
        data->>'employeeName' as employee_name 
      FROM performance_data 
      WHERE data->>'employeeName' IS NOT NULL 
      LIMIT 10
    `);
    console.log('\nSample performance data:');
    console.table(perfResult.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStores();