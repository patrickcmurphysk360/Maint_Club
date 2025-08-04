const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testScorecardData() {
  console.log('🧪 Testing Scorecard Data Access for Akeen Jackson - August 2025\n');
  
  try {
    // First, find Akeen Jackson's user ID and verify performance data exists
    console.log('1. Finding Akeen Jackson...');
    const userResult = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, s.name as store_name, m.name as market_name
      FROM users u
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
      OR LOWER(u.first_name || ' ' || u.last_name) LIKE '%jackson%akeen%'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Akeen Jackson not found in users table');
      return;
    }
    
    const akeenUser = userResult.rows[0];
    console.log(`✅ Found: ${akeenUser.first_name} ${akeenUser.last_name} (ID: ${akeenUser.id})`);
    console.log(`   Store: ${akeenUser.store_name}, Market: ${akeenUser.market_name}\n`);
    
    // 2. Check performance_data table for August 2025
    console.log('2. Checking performance_data table for August 2025...');
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        pd.store_id,
        s.name as store_name,
        pd.data_type
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      WHERE pd.advisor_user_id = $1
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 8
      ORDER BY pd.upload_date DESC
    `, [akeenUser.id]);
    
    console.log(`Found ${performanceResult.rows.length} performance records for August 2025:`);
    performanceResult.rows.forEach((record, index) => {
      const date = new Date(record.upload_date).toLocaleDateString();
      console.log(`  ${index + 1}. ${date} - ${record.store_name} (${record.data_type})`);
      if (record.data) {
        const data = record.data;
        console.log(`     Sales: $${data.sales?.toLocaleString() || 'N/A'}, Alignments: ${data.alignments || 'N/A'}`);
      }
    });
    console.log('');
    
    // 3. Check if scorecard_data table exists and has data
    console.log('3. Checking scorecard_data table...');
    try {
      const scorecardResult = await pool.query(`
        SELECT 
          sd.id,
          sd.upload_date,
          sd.data,
          sd.advisor_user_id,
          s.name as store_name,
          u.first_name,
          u.last_name
        FROM scorecard_data sd
        LEFT JOIN stores s ON sd.store_id = s.id
        LEFT JOIN users u ON sd.advisor_user_id = u.id
        WHERE sd.advisor_user_id = $1
          AND EXTRACT(YEAR FROM sd.upload_date) = 2025
          AND EXTRACT(MONTH FROM sd.upload_date) = 8
        ORDER BY sd.upload_date DESC
      `, [akeenUser.id]);
      
      console.log(`Found ${scorecardResult.rows.length} scorecard records for August 2025:`);
      scorecardResult.rows.forEach((record, index) => {
        const date = new Date(record.upload_date).toLocaleDateString();
        console.log(`  ${index + 1}. ${date} - ${record.store_name}`);
        if (record.data) {
          const data = record.data;
          console.log(`     Scorecard Data Keys: ${Object.keys(data).join(', ')}`);
          // Show key metrics if available
          if (data.sales) console.log(`     Sales: $${data.sales.toLocaleString()}`);
          if (data.alignments) console.log(`     Alignments: ${data.alignments}`);
          if (data.gpPercent) console.log(`     GP%: ${data.gpPercent}%`);
        }
      });
    } catch (scorecardError) {
      console.log(`⚠️ Scorecard table error: ${scorecardError.message}`);
      
      // Check if the table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scorecard_data'
      `);
      
      if (tableCheck.rows.length === 0) {
        console.log('❌ scorecard_data table does not exist');
      } else {
        console.log('✅ scorecard_data table exists but query failed');
      }
    }
    console.log('');
    
    // 4. Check advisor_mappings for spreadsheet data
    console.log('4. Checking advisor_mappings for August 2025...');
    try {
      const mappingResult = await pool.query(`
        SELECT 
          am.id,
          am.spreadsheet_name,
          am.user_id,
          am.created_at,
          s.name as store_name
        FROM advisor_mappings am
        LEFT JOIN stores s ON am.store_id = s.id
        WHERE am.user_id = $1
          AND EXTRACT(YEAR FROM am.created_at) = 2025
          AND EXTRACT(MONTH FROM am.created_at) = 8
        ORDER BY am.created_at DESC
      `, [akeenUser.id]);
      
      console.log(`Found ${mappingResult.rows.length} advisor mapping records for August 2025:`);
      mappingResult.rows.forEach((record, index) => {
        const date = new Date(record.created_at).toLocaleDateString();
        console.log(`  ${index + 1}. ${date} - ${record.spreadsheet_name} (${record.store_name})`);
      });
    } catch (mappingError) {
      console.log(`⚠️ Advisor mappings error: ${mappingError.message}`);
    }
    console.log('');
    
    // 5. List all available tables that might contain scorecard data
    console.log('5. Available tables that might contain scorecard/performance data...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%scorecard%' 
           OR table_name LIKE '%performance%' 
           OR table_name LIKE '%advisor%'
           OR table_name LIKE '%data%')
      ORDER BY table_name
    `);
    
    console.log('Relevant tables found:');
    tablesResult.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing scorecard data:', error);
  } finally {
    await pool.end();
  }
}

testScorecardData();