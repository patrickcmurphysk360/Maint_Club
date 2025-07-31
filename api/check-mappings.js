const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function checkMappingsTable() {
  try {
    console.log('🔍 Checking advisor_mappings table structure...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'advisor_mappings' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    console.log('\nSample data from table:');
    const sample = await pool.query('SELECT * FROM advisor_mappings LIMIT 5');
    console.log('Columns in actual data:', Object.keys(sample.rows[0] || {}));
    
    sample.rows.forEach((row, i) => {
      console.log(`  Row ${i + 1}:`, row);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMappingsTable();