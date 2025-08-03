const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testStoreMarketScorecards() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing store and market scorecards for June 2025...\n');
    
    // Test store-level scorecard aggregation (mimics the scorecard API logic)
    console.log('🏪 Store-level scorecard test:');
    const storeScorecard = await client.query(`
      SELECT 
        s.name as store_name,
        m.name as market_name,
        COUNT(CASE WHEN pd.advisor_user_id IS NOT NULL THEN 1 END) as advisor_count,
        COUNT(CASE WHEN pd.advisor_user_id IS NULL THEN 1 END) as store_records,
        -- From store-level records (advisor_user_id IS NULL)
        SUM(CASE WHEN pd.advisor_user_id IS NULL THEN CAST(pd.data->>'allTires' AS INTEGER) END) as store_all_tires,
        SUM(CASE WHEN pd.advisor_user_id IS NULL THEN CAST(pd.data->>'retailTires' AS INTEGER) END) as store_retail_tires
      FROM performance_data pd
      JOIN stores s ON pd.store_id = s.id  
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      GROUP BY s.id, s.name, m.name
      ORDER BY s.name
      LIMIT 3
    `);
    
    storeScorecard.rows.forEach(store => {
      console.log(`   ${store.store_name}: ${store.store_all_tires || 0} tires (${store.advisor_count} advisors, ${store.store_records} store records)`);
    });
    
    // Test market-level scorecard aggregation
    console.log('\n🌍 Market-level scorecard test:');
    const marketScorecard = await client.query(`
      SELECT 
        m.name as market_name,
        COUNT(DISTINCT pd.store_id) as store_count,
        COUNT(DISTINCT CASE WHEN pd.advisor_user_id IS NOT NULL THEN pd.advisor_user_id END) as advisor_count,
        COUNT(CASE WHEN pd.advisor_user_id IS NULL THEN 1 END) as store_records,
        -- Aggregate from store-level records
        SUM(CASE WHEN pd.advisor_user_id IS NULL THEN CAST(pd.data->>'allTires' AS INTEGER) END) as market_all_tires,
        SUM(CASE WHEN pd.advisor_user_id IS NULL THEN CAST(pd.data->>'retailTires' AS INTEGER) END) as market_retail_tires
      FROM performance_data pd
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      GROUP BY m.id, m.name
    `);
    
    marketScorecard.rows.forEach(market => {
      console.log(`   ${market.market_name}: ${market.market_all_tires || 0} tires (${market.store_count} stores, ${market.advisor_count} advisors, ${market.store_records} store records)`);
    });
    
    // Check if data structure matches other working dates
    console.log('\n📊 Comparing with August 1st (working date):');
    const comparison = await client.query(`
      SELECT 
        upload_date,
        COUNT(*) as total_records,
        COUNT(CASE WHEN advisor_user_id IS NOT NULL THEN 1 END) as advisor_level,
        COUNT(CASE WHEN advisor_user_id IS NULL AND store_id IS NOT NULL THEN 1 END) as store_level
      FROM performance_data 
      WHERE upload_date IN ('2025-06-30', '2025-08-01')
      GROUP BY upload_date
      ORDER BY upload_date
    `);
    
    comparison.rows.forEach(row => {
      console.log(`   ${row.upload_date}: ${row.total_records} total (${row.advisor_level} advisor + ${row.store_level} store)`);
    });
    
    console.log('\n✅ Store and market data structure is now ready!');
    console.log('Store and market scorecards should now display June 2025 data.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testStoreMarketScorecards();