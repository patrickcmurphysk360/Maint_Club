const { Pool } = require('pg');
const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function checkData() {
  const result = await pool.query('SELECT data FROM performance_data WHERE advisor_user_id = 243 LIMIT 1');
  console.log('Sample data structure:');
  console.log(JSON.stringify(result.rows[0].data, null, 2));
  await pool.end();
}
checkData();