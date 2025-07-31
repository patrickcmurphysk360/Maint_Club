// Debug script to compare spreadsheet names vs mappings
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function debugNames() {
  try {
    console.log('🔍 Debugging name matching...\n');
    
    // Get spreadsheet employee names
    const session = await pool.query('SELECT raw_data FROM upload_sessions WHERE id = 26');
    const employeeData = session.rows[0].raw_data.employees;
    
    console.log('📋 Employee names from spreadsheet:');
    const spreadsheetNames = employeeData.map(emp => emp.Employee).filter(name => name);
    spreadsheetNames.forEach((name, i) => {
      console.log(`  ${i + 1}. "${name}"`);
    });
    
    // Get advisor mapping names
    const mappings = await pool.query('SELECT spreadsheet_name FROM advisor_mappings WHERE is_active = true ORDER BY spreadsheet_name');
    
    console.log('\n📋 Names in advisor_mappings:');
    mappings.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. "${row.spreadsheet_name}"`);
    });
    
    // Find matches
    console.log('\n🎯 Matches found:');
    let matchCount = 0;
    spreadsheetNames.forEach(spreadsheetName => {
      const mapping = mappings.rows.find(m => m.spreadsheet_name === spreadsheetName);
      if (mapping) {
        console.log(`  ✅ "${spreadsheetName}"`);
        matchCount++;
      }
    });
    
    console.log('\n⚠️  No matches found:');
    spreadsheetNames.forEach(spreadsheetName => {
      const mapping = mappings.rows.find(m => m.spreadsheet_name === spreadsheetName);
      if (!mapping) {
        console.log(`  ❌ "${spreadsheetName}"`);
      }
    });
    
    console.log(`\n📊 Summary: ${matchCount}/${spreadsheetNames.length} names matched`);
    
    // Check if there are similar names (case differences, etc.)
    console.log('\n🔍 Checking for similar names...');
    spreadsheetNames.forEach(spreadsheetName => {
      const mapping = mappings.rows.find(m => 
        m.spreadsheet_name.toLowerCase() === spreadsheetName.toLowerCase()
      );
      if (mapping && mapping.spreadsheet_name !== spreadsheetName) {
        console.log(`  📝 Case difference: "${spreadsheetName}" vs "${mapping.spreadsheet_name}"`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugNames();