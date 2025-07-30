const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'admin',
  password: 'ducks2020'
});

async function createMappings() {
  try {
    const result = await pool.query(`
      INSERT INTO advisor_mappings (spreadsheet_name, user_id, market_id, store_id, is_active)
      SELECT DISTINCT
        pd.data->>'employeeName' as spreadsheet_name,
        pd.advisor_user_id as user_id,
        694 as market_id,
        57 as store_id,
        true as is_active
      FROM performance_data pd
      WHERE pd.data->>'employeeName' IS NOT NULL
      AND pd.data->>'employeeName' <> ''
      ON CONFLICT DO NOTHING
    `);
    console.log('Advisor mappings created successfully:', result.rowCount, 'rows inserted');
    
    // Also check what we created
    const checkResult = await pool.query('SELECT COUNT(*) FROM advisor_mappings');
    console.log('Total advisor mappings now:', checkResult.rows[0].count);
    
  } catch (error) {
    console.error('Error creating mappings:', error.message);
  } finally {
    await pool.end();
  }
}

createMappings();