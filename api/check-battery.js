const { Pool } = require('pg');
const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function checkBattery() {
  const result = await pool.query("SELECT data->>'battery' as battery_raw, data->>'Battery' as battery_cap FROM performance_data WHERE advisor_user_id = 243 LIMIT 2");
  console.log('Battery field check:');
  result.rows.forEach((row, i) => {
    console.log(`Record ${i+1}: battery=${row.battery_raw}, Battery=${row.battery_cap}`);
  });
  await pool.end();
}
checkBattery();