const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function fixJuneMappings() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing June 2025 data mappings...\n');
    
    // Get market ID
    const marketResult = await client.query(
      'SELECT id FROM markets WHERE name = $1',
      ['Tire South - Tekmetric']
    );
    
    if (marketResult.rows.length === 0) {
      throw new Error('Market "Tire South - Tekmetric" not found');
    }
    
    const marketId = marketResult.rows[0].id;
    console.log(`📍 Market ID: ${marketId}`);
    
    // Get all stores for this market
    const storesResult = await client.query(
      'SELECT id, name FROM stores WHERE market_id = $1',
      [marketId]
    );
    
    const storeMap = {};
    storesResult.rows.forEach(store => {
      storeMap[store.name] = store.id;
    });
    console.log('🏪 Store mappings:', storeMap);
    
    // Get all advisor mappings
    const advisorsResult = await client.query(
      'SELECT spreadsheet_name, user_id FROM advisor_mappings WHERE is_active = true'
    );
    
    const advisorMap = {};
    advisorsResult.rows.forEach(advisor => {
      advisorMap[advisor.spreadsheet_name] = advisor.user_id;
    });
    console.log(`👥 Advisor mappings: ${Object.keys(advisorMap).length} advisors`);
    
    // Get all June 2025 records that need fixing
    const juneDataResult = await client.query(`
      SELECT id, data->>'employeeName' as employee_name, 
             data->>'storeName' as store_name, 
             data->>'market' as market
      FROM performance_data 
      WHERE upload_date = '2025-06-30' 
      AND (market_id IS NULL OR store_id IS NULL OR advisor_user_id IS NULL)
    `);
    
    console.log(`\n📊 Found ${juneDataResult.rows.length} records to fix`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    // Fix each record
    for (const record of juneDataResult.rows) {
      const storeId = storeMap[record.store_name];
      const advisorId = advisorMap[record.employee_name];
      
      if (!storeId) {
        console.warn(`⚠️ Store not found: ${record.store_name}`);
        skippedCount++;
        continue;
      }
      
      if (!advisorId) {
        console.warn(`⚠️ Advisor not mapped: ${record.employee_name}`);
        skippedCount++;
        continue;
      }
      
      // Update the record with proper mappings
      await client.query(`
        UPDATE performance_data 
        SET market_id = $1, store_id = $2, advisor_user_id = $3
        WHERE id = $4
      `, [marketId, storeId, advisorId, record.id]);
      
      fixedCount++;
      
      if (fixedCount % 10 === 0) {
        console.log(`   Fixed ${fixedCount} records...`);
      }
    }
    
    console.log(`\n✅ Mapping fix complete:`);
    console.log(`   Fixed: ${fixedCount} records`);
    console.log(`   Skipped: ${skippedCount} records`);
    
    // Verify the fix
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN market_id IS NOT NULL THEN 1 END) as with_market,
        COUNT(CASE WHEN store_id IS NOT NULL THEN 1 END) as with_store,
        COUNT(CASE WHEN advisor_user_id IS NOT NULL THEN 1 END) as with_advisor
      FROM performance_data 
      WHERE upload_date = '2025-06-30'
    `);
    
    console.log('\n🔍 Verification:');
    const verify = verifyResult.rows[0];
    console.log(`   Total records: ${verify.total}`);
    console.log(`   With market_id: ${verify.with_market}`);
    console.log(`   With store_id: ${verify.with_store}`);
    console.log(`   With advisor_user_id: ${verify.with_advisor}`);
    
    if (verify.with_market === verify.total && verify.with_store === verify.total) {
      console.log('\n🎉 All records now have proper mappings!');
      console.log('The June 2025 data should now appear in scorecards.');
    } else {
      console.log('\n⚠️ Some records still missing mappings. Check advisor mappings.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixJuneMappings();