// Test script to diagnose upload issues
const { Pool } = require('pg');

console.log('🔍 Testing Maintenance Club Upload System...\n');

// Test 1: Database Connection
console.log('1. Testing database connection...');
const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function testDatabase() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Test required tables
    const tables = ['markets', 'stores', 'users', 'advisor_mappings', 'upload_sessions'];
    for (let table of tables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✅ Table ${table}: ${count.rows[0].count} records`);
      } catch (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
      }
    }
    
    // Test specific queries that upload system uses
    console.log('\n2. Testing upload system queries...');
    
    try {
      const markets = await pool.query('SELECT id, name FROM markets ORDER BY name');
      console.log(`✅ Markets query: ${markets.rows.length} markets found`);
      if (markets.rows.length > 0) {
        console.log(`   Sample: ${markets.rows[0].id} - ${markets.rows[0].name}`);
      }
    } catch (error) {
      console.log(`❌ Markets query failed: ${error.message}`);
    }
    
    try {
      const stores = await pool.query('SELECT id, name, market_id FROM stores ORDER BY name');
      console.log(`✅ Stores query: ${stores.rows.length} stores found`);
      if (stores.rows.length > 0) {
        console.log(`   Sample: ${stores.rows[0].id} - ${stores.rows[0].name} (Market: ${stores.rows[0].market_id})`);
      }
    } catch (error) {
      console.log(`❌ Stores query failed: ${error.message}`);
    }
    
    try {
      const users = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE role = \'advisor\' ORDER BY first_name, last_name');
      console.log(`✅ Advisor users query: ${users.rows.length} advisors found`);
      if (users.rows.length > 0) {
        console.log(`   Sample: ${users.rows[0].id} - ${users.rows[0].first_name} ${users.rows[0].last_name}`);
      }
    } catch (error) {
      console.log(`❌ Advisor users query failed: ${error.message}`);
    }
    
    try {
      const mappings = await pool.query('SELECT spreadsheet_name, user_id, is_active FROM advisor_mappings WHERE is_active = true');
      console.log(`✅ Advisor mappings query: ${mappings.rows.length} mappings found`);
      if (mappings.rows.length > 0) {
        console.log(`   Sample: ${mappings.rows[0].spreadsheet_name} -> ${mappings.rows[0].user_id}`);
      }
    } catch (error) {
      console.log(`❌ Advisor mappings query failed: ${error.message}`);
    }
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Test 2: Check if UploadProcessor exists
console.log('\n3. Testing UploadProcessor service...');
try {
  const UploadProcessor = require('./services/uploadProcessor');
  console.log('✅ UploadProcessor service found');
  
  // Test if we can instantiate it
  const processor = new UploadProcessor(pool);
  console.log('✅ UploadProcessor instantiated successfully');
} catch (error) {
  console.log('❌ UploadProcessor error:', error.message);
}

// Test 3: Check file upload dependencies
console.log('\n4. Testing upload dependencies...');
try {
  const multer = require('multer');
  console.log('✅ Multer (file upload) available');
} catch (error) {
  console.log('❌ Multer missing:', error.message);
}

try {
  const XLSX = require('xlsx');
  console.log('✅ XLSX (spreadsheet parsing) available');
} catch (error) {
  console.log('❌ XLSX missing:', error.message);
}

// Run all tests
testDatabase().then(() => {
  console.log('\n🏁 Upload system diagnosis complete');
}).catch(error => {
  console.error('💥 Test failed:', error);
});