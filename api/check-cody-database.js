const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function checkDatabase() {
  try {
    console.log('Checking database data for Cody Lanier (ID: 244)...');
    
    // Check what data exists for Cody Lanier (ID: 244)
    const result = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data->'invoices' as invoices,
        pd.data->'sales' as sales,
        pd.data_type,
        s.name as store_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id::text = s.id::text
      WHERE pd.advisor_user_id = 244
      ORDER BY pd.upload_date DESC
      LIMIT 5
    `);
    
    console.log('Database records found:', result.rows.length);
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.upload_date}: ${row.invoices} invoices, $${row.sales} sales (${row.data_type}) at ${row.store_name}`);
    });
    
    // Also check if there are any records at all
    const totalCount = await pool.query('SELECT COUNT(*) FROM performance_data WHERE advisor_user_id = 244');
    console.log(`Total records for Cody: ${totalCount.rows[0].count}`);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkDatabase();