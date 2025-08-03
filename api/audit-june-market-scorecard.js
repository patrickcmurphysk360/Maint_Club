const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function auditJuneMarketScorecard() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Auditing June 2025 Market Scorecard for Tire South - Tekmetric\n');
    
    // Get market-level aggregation from store records
    console.log('📊 Market aggregation from store-level records:');
    const marketFromStores = await client.query(`
      SELECT 
        m.name as market_name,
        COUNT(DISTINCT pd.store_id) as store_count,
        SUM(CAST(pd.data->>'invoices' AS INTEGER)) as total_invoices,
        SUM(CAST(pd.data->>'sales' AS NUMERIC)) as total_sales,
        SUM(CAST(pd.data->>'gpSales' AS NUMERIC)) as total_gp_sales,
        SUM(CAST(pd.data->>'allTires' AS INTEGER)) as total_all_tires,
        SUM(CAST(pd.data->>'retailTires' AS INTEGER)) as total_retail_tires,
        SUM(CAST(pd.data->>'tireProtection' AS INTEGER)) as total_tire_protection,
        SUM(CAST(pd.data->>'potentialAlignments' AS INTEGER)) as total_potential_alignments,
        SUM(CAST(pd.data->>'potentialAlignmentsSold' AS INTEGER)) as total_alignments_sold,
        SUM(CAST(pd.data->>'brakeService' AS INTEGER)) as total_brake_service,
        SUM(CAST(pd.data->>'brakeFlush' AS INTEGER)) as total_brake_flush,
        SUM(CAST(pd.data->>'acService' AS INTEGER)) as total_ac_service,
        SUM(CAST(pd.data->>'wiperBlades' AS INTEGER)) as total_wiper_blades,
        SUM(CAST(pd.data->>'shocksStruts' AS INTEGER)) as total_shocks_struts
      FROM performance_data pd
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NULL  -- Store-level records only
      AND pd.store_id IS NOT NULL
      AND m.id = 694
      GROUP BY m.id, m.name
    `);
    
    if (marketFromStores.rows.length > 0) {
      const market = marketFromStores.rows[0];
      console.log(`   Market: ${market.market_name}`);
      console.log(`   Stores: ${market.store_count}`);
      console.log(`   Invoices: ${market.total_invoices || 0}`);
      console.log(`   Sales: $${parseFloat(market.total_sales || 0).toFixed(2)}`);
      console.log(`   GP Sales: $${parseFloat(market.total_gp_sales || 0).toFixed(2)}`);
      console.log(`   All Tires: ${market.total_all_tires || 0}`);
      console.log(`   Retail Tires: ${market.total_retail_tires || 0}`);
      console.log(`   Tire Protection: ${market.total_tire_protection || 0}`);
      
      // Calculate percentages
      const tireProtectionPercent = market.total_retail_tires > 0 ? 
        ((market.total_tire_protection / market.total_retail_tires) * 100).toFixed(1) : 0;
      console.log(`   Tire Protection %: ${tireProtectionPercent}%`);
      
      console.log(`   Potential Alignments: ${market.total_potential_alignments || 0}`);
      console.log(`   Alignments Sold: ${market.total_alignments_sold || 0}`);
      
      const alignmentPercent = market.total_potential_alignments > 0 ? 
        ((market.total_alignments_sold / market.total_potential_alignments) * 100).toFixed(1) : 0;
      console.log(`   Potential Alignments %: ${alignmentPercent}%`);
      
      console.log(`   Brake Service: ${market.total_brake_service || 0}`);
      console.log(`   Brake Flush: ${market.total_brake_flush || 0}`);
      
      const brakeFlushPercent = market.total_brake_service > 0 ? 
        ((market.total_brake_flush / market.total_brake_service) * 100).toFixed(1) : 0;
      console.log(`   Brake Flush to Service %: ${brakeFlushPercent}%`);
    }
    
    // Also check advisor-level aggregation
    console.log('\n📊 Market aggregation from advisor-level records:');
    const marketFromAdvisors = await client.query(`
      SELECT 
        m.name as market_name,
        COUNT(DISTINCT pd.advisor_user_id) as advisor_count,
        COUNT(DISTINCT pd.store_id) as store_count,
        SUM(CAST(pd.data->>'invoices' AS INTEGER)) as total_invoices,
        SUM(CAST(pd.data->>'sales' AS NUMERIC)) as total_sales,
        SUM(CAST(pd.data->>'allTires' AS INTEGER)) as total_all_tires,
        SUM(CAST(pd.data->>'retailTires' AS INTEGER)) as total_retail_tires,
        SUM(CAST(pd.data->>'tireProtection' AS INTEGER)) as total_tire_protection,
        SUM(CAST(pd.data->>'potentialAlignments' AS INTEGER)) as total_potential_alignments,
        SUM(CAST(pd.data->>'potentialAlignmentsSold' AS INTEGER)) as total_alignments_sold,
        SUM(CAST(pd.data->>'brakeService' AS INTEGER)) as total_brake_service,
        SUM(CAST(pd.data->>'brakeFlush' AS INTEGER)) as total_brake_flush
      FROM performance_data pd
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NOT NULL  -- Advisor-level records only
      AND m.id = 694
      GROUP BY m.id, m.name
    `);
    
    if (marketFromAdvisors.rows.length > 0) {
      const market = marketFromAdvisors.rows[0];
      console.log(`   Market: ${market.market_name}`);
      console.log(`   Advisors: ${market.advisor_count}`);
      console.log(`   Stores: ${market.store_count}`);
      console.log(`   All Tires: ${market.total_all_tires || 0}`);
      console.log(`   Retail Tires: ${market.total_retail_tires || 0}`);
      console.log(`   Tire Protection: ${market.total_tire_protection || 0}`);
    }
    
    // Check raw data from upload session
    console.log('\n📋 Checking raw data from upload session:');
    const sessionData = await client.query(`
      SELECT raw_data
      FROM upload_sessions
      WHERE id = 41
    `);
    
    if (sessionData.rows.length > 0 && sessionData.rows[0].raw_data) {
      const rawData = sessionData.rows[0].raw_data;
      console.log(`   Employee records: ${rawData.employees?.length || 0}`);
      console.log(`   Store records: ${rawData.stores?.length || 0}`);
      console.log(`   Market records: ${rawData.markets?.length || 0}`);
      
      if (rawData.markets && rawData.markets.length > 0) {
        console.log('\n📊 Market tab data from spreadsheet:');
        const marketData = rawData.markets[0];
        console.log(JSON.stringify(marketData, null, 2));
      }
    }
    
    console.log('\n💡 AUDIT SUMMARY:');
    console.log('The database is aggregating from store-level records.');
    console.log('To compare with spreadsheet market tab, we need the original Excel file.');
    console.log('Current database totals are based on aggregated advisor data.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

auditJuneMarketScorecard();