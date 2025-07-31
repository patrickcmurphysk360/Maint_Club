const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function checkTables() {
  try {
    console.log('🔍 Checking database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected at:', result.rows[0].now);
    
    console.log('\n📋 Listing all tables:');
    const tables = await pool.query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} tables:`);
    tables.rows.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    console.log('\n🔍 Checking for phase1_ tables:');
    const phase1Tables = tables.rows.filter(t => t.table_name.startsWith('phase1_'));
    console.log('Phase1 tables found:', phase1Tables.length);
    phase1Tables.forEach(t => console.log('  -', t.table_name));
    
    console.log('\n🔍 Checking for regular tables (users, markets, stores):');
    const regularTables = ['users', 'markets', 'stores', 'performance_data', 'upload_sessions', 'advisor_mappings'];
    for (let tableName of regularTables) {
      const exists = tables.rows.find(t => t.table_name === tableName);
      console.log('  -', tableName, exists ? '✅ EXISTS' : '❌ MISSING');
    }
    
    console.log('\n🔍 Checking upload-related tables:');
    const uploadTables = tables.rows.filter(t => 
      t.table_name.includes('upload') || 
      t.table_name.includes('session') || 
      t.table_name.includes('performance')
    );
    console.log('Upload-related tables:', uploadTables.length);
    uploadTables.forEach(t => console.log('  -', t.table_name));
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();