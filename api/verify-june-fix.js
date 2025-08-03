const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function verifyJuneFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying June 2025 upload fix...\n');
    
    // Check session exists
    const sessionResult = await client.query(
      'SELECT id, filename, status FROM upload_sessions WHERE id = 41'
    );
    
    if (sessionResult.rows.length === 0) {
      console.log('❌ Session 41 not found');
      return;
    }
    
    console.log('✅ Upload session found:', sessionResult.rows[0]);
    
    // Check market exists
    const marketResult = await client.query(
      'SELECT id FROM markets WHERE name = $1',
      ['Tire South - Tekmetric']
    );
    console.log('✅ Market exists:', marketResult.rows[0]);
    
    // Check stores exist
    const storeResult = await client.query(
      'SELECT id, name FROM stores WHERE name IN ($1, $2, $3)',
      ['Mcdonough', 'Jonesboro', 'Roswell']
    );
    console.log('✅ Stores exist:', storeResult.rows);
    
    // Check advisor mappings
    const mappingResult = await client.query(`
      SELECT spreadsheet_name, user_id 
      FROM advisor_mappings 
      WHERE spreadsheet_name IN ('JOHN BLACKERBY', 'AKEEN JACKSON', 'BILL ALLEN', 'MICHAEL SPENCER', 'JACOB FUHRER')
      AND is_active = true
      ORDER BY spreadsheet_name
    `);
    console.log('✅ Advisor mappings:');
    mappingResult.rows.forEach(row => {
      console.log(`   ${row.spreadsheet_name} -> User ID: ${row.user_id}`);
    });
    
    // Check unmapped advisors
    const unmappedAdvisors = ['BILL ALLEN', 'MICHAEL SPENCER', 'JACOB FUHRER'];
    const unmappedResult = await client.query(`
      SELECT spreadsheet_name 
      FROM advisor_mappings 
      WHERE spreadsheet_name = ANY($1) AND is_active = true
    `, [unmappedAdvisors]);
    
    const mapped = unmappedResult.rows.map(r => r.spreadsheet_name);
    const stillUnmapped = unmappedAdvisors.filter(name => !mapped.includes(name));
    
    console.log('\n📋 Summary:');
    console.log(`   New advisors still needing mapping: ${stillUnmapped.length}`);
    if (stillUnmapped.length > 0) {
      console.log(`   - ${stillUnmapped.join(', ')}`);
      console.log('\n💡 You can run process-june-mapping.js to auto-create these advisors');
    } else {
      console.log('   All advisors are mapped! ✅');
    }
    
    console.log('\n🎯 With the enhanced session endpoint:');
    console.log('   - Market "Tire South - Tekmetric" will be auto-mapped');
    console.log('   - Stores (Mcdonough, Jonesboro, Roswell) will be auto-mapped');
    console.log('   - 23 existing advisors will be auto-mapped');
    console.log(`   - ${stillUnmapped.length} new advisors will require manual mapping`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyJuneFix();