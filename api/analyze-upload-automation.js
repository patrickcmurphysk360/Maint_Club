const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function analyzeUploadAutomation() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Analyzing upload automation for subsequent uploads...\n');
    
    // Check current advisor mappings
    const advisorMappings = await client.query(
      'SELECT COUNT(*) as total_mappings FROM advisor_mappings WHERE is_active = true'
    );
    console.log(`👥 Current advisor mappings: ${advisorMappings.rows[0].total_mappings}`);
    
    // Check current stores
    const stores = await client.query(
      'SELECT COUNT(*) as total_stores, COUNT(DISTINCT market_id) as markets FROM stores'
    );
    console.log(`🏪 Current stores: ${stores.rows[0].total_stores} across ${stores.rows[0].markets} markets`);
    
    // Check current markets
    const markets = await client.query(
      'SELECT COUNT(*) as total_markets FROM markets'
    );
    console.log(`🌍 Current markets: ${markets.rows[0].total_markets}`);
    
    console.log('\n📋 What happens with NEW uploads:');
    console.log('\n1. 👥 ADVISOR AUTOMATION:');
    console.log('   ✅ Existing advisors: Auto-mapped via enhanced session endpoint');
    console.log('   ⚠️  New advisors: Require manual mapping OR auto-creation');
    console.log('   ✅ Data linkage: Automatic via advisor_mappings table');
    
    console.log('\n2. 🏪 STORE AUTOMATION:');
    console.log('   ✅ Existing stores: Auto-mapped via enhanced session endpoint');
    console.log('   ⚠️  New stores: Require manual mapping OR auto-creation');
    console.log('   ✅ Data linkage: Automatic via store mappings');
    
    console.log('\n3. 🌍 MARKET AUTOMATION:');
    console.log('   ✅ Existing markets: Auto-mapped via enhanced session endpoint');
    console.log('   ⚠️  New markets: Require manual mapping OR auto-creation');
    console.log('   ✅ Data linkage: Automatic via market mappings');
    
    console.log('\n4. 📊 DATA LEVEL PROCESSING:');
    console.log('   ✅ Advisor-level: Automatically processed from "Employees" sheet');
    console.log('   ❌ Store-level: Requires "Stores" sheet in Excel OR manual generation');
    console.log('   ❌ Market-level: Requires "Markets" sheet in Excel OR manual generation');
    
    console.log('\n5. 🔧 CURRENT GAPS:');
    console.log('   ❌ No automatic store-level data generation');
    console.log('   ❌ Spreadsheets only contain advisor-level data');
    console.log('   ❌ Manual post-processing needed for store/market aggregation');
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   1. Add automatic store-level data generation after advisor processing');
    console.log('   2. Add automatic market-level data generation if needed');
    console.log('   3. Consider auto-creating new advisors for known stores/markets');
    console.log('   4. Monitor upload patterns to improve automation');
    
    // Check recent upload patterns
    const recentUploads = await client.query(`
      SELECT 
        upload_date,
        COUNT(*) as total_records,
        COUNT(CASE WHEN advisor_user_id IS NOT NULL THEN 1 END) as advisor_level,
        COUNT(CASE WHEN advisor_user_id IS NULL AND store_id IS NOT NULL THEN 1 END) as store_level,
        COUNT(CASE WHEN advisor_user_id IS NULL AND store_id IS NULL THEN 1 END) as market_level
      FROM performance_data 
      WHERE upload_date >= '2025-06-01'
      GROUP BY upload_date 
      ORDER BY upload_date DESC
      LIMIT 5
    `);
    
    console.log('\n📈 Recent upload data patterns:');
    recentUploads.rows.forEach(row => {
      console.log(`   ${row.upload_date}: ${row.advisor_level}A + ${row.store_level}S + ${row.market_level}M = ${row.total_records} total`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeUploadAutomation();