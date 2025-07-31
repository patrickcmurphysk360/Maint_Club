const { Pool } = require('pg');
const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function checkTables() {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%scorecard%'
    ORDER BY table_name
  `);
  
  console.log('Scorecard-related tables:');
  result.rows.forEach(row => console.log('  -', row.table_name));
  
  // Check structure of scorecard_templates
  if (result.rows.some(row => row.table_name === 'scorecard_templates')) {
    console.log('\nScorecard_templates structure:');
    const structure = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scorecard_templates'");
    structure.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  }
  
  await pool.end();
}
checkTables();