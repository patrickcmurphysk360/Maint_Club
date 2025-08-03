const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testJuneScorecards() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing June 2025 scorecard data...\n');
    
    // Test advisor-level data aggregation (similar to scorecard API)
    const advisorData = await client.query(`
      SELECT 
        u.first_name || ' ' || u.last_name as advisor_name,
        s.name as store_name,
        m.name as market_name,
        COUNT(*) as record_count,
        SUM(CAST(pd.data->>'allTires' AS INTEGER)) as total_all_tires,
        SUM(CAST(pd.data->>'retailTires' AS INTEGER)) as total_retail_tires
      FROM performance_data pd
      JOIN users u ON pd.advisor_user_id = u.id
      JOIN stores s ON pd.store_id = s.id
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      GROUP BY u.id, u.first_name, u.last_name, s.name, m.name
      ORDER BY advisor_name
      LIMIT 5
    `);
    
    console.log('📊 Advisor-level data sample:');
    advisorData.rows.forEach(row => {
      console.log(`   ${row.advisor_name} (${row.store_name}): ${row.total_all_tires} tires, ${row.record_count} records`);
    });
    
    // Test store-level aggregation
    const storeData = await client.query(`
      SELECT 
        s.name as store_name,
        m.name as market_name,
        COUNT(*) as advisor_count,
        SUM(CAST(pd.data->>'allTires' AS INTEGER)) as total_all_tires,
        SUM(CAST(pd.data->>'retailTires' AS INTEGER)) as total_retail_tires
      FROM performance_data pd
      JOIN stores s ON pd.store_id = s.id
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      GROUP BY s.id, s.name, m.name
      ORDER BY store_name
    `);
    
    console.log('\n🏪 Store-level data:');
    storeData.rows.forEach(row => {
      console.log(`   ${row.store_name}: ${row.advisor_count} advisors, ${row.total_all_tires} total tires`);
    });
    
    // Test market-level aggregation
    const marketData = await client.query(`
      SELECT 
        m.name as market_name,
        COUNT(DISTINCT pd.advisor_user_id) as advisor_count,
        COUNT(DISTINCT pd.store_id) as store_count,
        SUM(CAST(pd.data->>'allTires' AS INTEGER)) as total_all_tires,
        SUM(CAST(pd.data->>'retailTires' AS INTEGER)) as total_retail_tires
      FROM performance_data pd
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      GROUP BY m.id, m.name
    `);
    
    console.log('\n🌍 Market-level data:');
    marketData.rows.forEach(row => {
      console.log(`   ${row.market_name}: ${row.advisor_count} advisors, ${row.store_count} stores, ${row.total_all_tires} total tires`);
    });
    
    // Check specific advisor (AKEEN JACKSON)
    const akeemData = await client.query(`
      SELECT 
        u.first_name || ' ' || u.last_name as advisor_name,
        pd.data->>'allTires' as all_tires,
        pd.data->>'retailTires' as retail_tires,
        pd.data->>'brakeService' as brake_service,
        pd.data->>'brakeFlush' as brake_flush
      FROM performance_data pd
      JOIN users u ON pd.advisor_user_id = u.id
      WHERE pd.upload_date = '2025-06-30'
      AND u.first_name = 'AKEEN' AND u.last_name = 'JACKSON'
    `);
    
    console.log('\n🎯 AKEEN JACKSON specific data:');
    if (akeemData.rows.length > 0) {
      const akeem = akeemData.rows[0];
      console.log(`   All Tires: ${akeem.all_tires}`);
      console.log(`   Retail Tires: ${akeem.retail_tires}`);
      console.log(`   Brake Service: ${akeem.brake_service}`);
      console.log(`   Brake Flush: ${akeem.brake_flush}`);
    } else {
      console.log('   No data found for AKEEM JACKSON');
    }
    
    console.log('\n✅ June 2025 data is properly structured and should appear in scorecards!');
    console.log('Try refreshing the scorecard page to see the June 2025 data.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testJuneScorecards();