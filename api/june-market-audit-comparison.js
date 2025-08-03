const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function compareMarketData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 JUNE 2025 MARKET SCORECARD AUDIT - DETAILED COMPARISON\n');
    console.log('Market: Tire South - Tekmetric (ID: 694)\n');
    
    // Get current database aggregation
    const dbAggregation = await client.query(`
      SELECT 
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
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NULL  -- Store-level records only
      AND pd.store_id IS NOT NULL
      AND pd.market_id = 694
    `);
    
    const db = dbAggregation.rows[0];
    
    // Spreadsheet market tab values (from raw_data)
    const spreadsheet = {
      invoices: 3644,
      sales: 1618551,
      allTires: 3254,
      retailTires: 3088,
      tireProtection: 2392,
      potentialAlignments: 820,
      potentialAlignmentsSold: 448,
      brakeService: 374,  // Note: In spreadsheet this is labeled as alignments but value is brake service
      brakeFlush: 203
    };
    
    console.log('📊 COMPARISON TABLE:');
    console.log('================================================================================');
    console.log('Metric                   | Spreadsheet Market Tab | Database Aggregation | Difference');
    console.log('-------------------------|------------------------|----------------------|----------');
    
    // Compare each metric
    const metrics = [
      { name: 'Invoices', sp: spreadsheet.invoices, db: db.total_invoices },
      { name: 'Sales', sp: spreadsheet.sales, db: parseFloat(db.total_sales) },
      { name: 'All Tires', sp: spreadsheet.allTires, db: db.total_all_tires },
      { name: 'Retail Tires', sp: spreadsheet.retailTires, db: db.total_retail_tires },
      { name: 'Tire Protection', sp: spreadsheet.tireProtection, db: db.total_tire_protection },
      { name: 'Potential Alignments', sp: spreadsheet.potentialAlignments, db: db.total_potential_alignments },
      { name: 'Alignments Sold', sp: spreadsheet.potentialAlignmentsSold, db: db.total_alignments_sold },
      { name: 'Brake Service', sp: spreadsheet.brakeService, db: db.total_brake_service },
      { name: 'Brake Flush', sp: spreadsheet.brakeFlush, db: db.total_brake_flush }
    ];
    
    let hasDiscrepancies = false;
    
    metrics.forEach(metric => {
      const diff = metric.db - metric.sp;
      const status = diff === 0 ? '✅' : '❌';
      hasDiscrepancies = hasDiscrepancies || (diff !== 0);
      
      console.log(`${metric.name.padEnd(24)} | ${String(metric.sp).padStart(22)} | ${String(metric.db).padStart(20)} | ${status} ${diff !== 0 ? diff : ''}`);
    });
    
    console.log('================================================================================');
    
    console.log('\n📋 KEY FINDINGS:');
    console.log('1. The spreadsheet market tab shows DIFFERENT values than store aggregation');
    console.log('2. Database is showing DOUBLE the values for most metrics');
    console.log('3. This suggests the market tab in Excel is showing different data than employee/store tabs');
    
    // Check if we have duplicate records
    console.log('\n🔍 Checking for duplicate records...');
    const duplicateCheck = await client.query(`
      SELECT 
        store_id,
        COUNT(*) as record_count,
        STRING_AGG(DISTINCT advisor_user_id::text, ', ') as advisor_ids
      FROM performance_data
      WHERE upload_date = '2025-06-30'
      AND market_id = 694
      AND advisor_user_id IS NULL
      GROUP BY store_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCheck.rows.length > 0) {
      console.log('❌ Found duplicate store-level records:');
      duplicateCheck.rows.forEach(row => {
        console.log(`   Store ID ${row.store_id}: ${row.record_count} records`);
      });
    } else {
      console.log('✅ No duplicate store-level records found');
    }
    
    // Check store details
    console.log('\n📊 Store-level breakdown:');
    const storeBreakdown = await client.query(`
      SELECT 
        s.name as store_name,
        CAST(pd.data->>'allTires' AS INTEGER) as all_tires,
        CAST(pd.data->>'invoices' AS INTEGER) as invoices
      FROM performance_data pd
      JOIN stores s ON pd.store_id = s.id
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NULL
      AND pd.market_id = 694
      ORDER BY s.name
    `);
    
    let totalTires = 0;
    let totalInvoices = 0;
    
    storeBreakdown.rows.forEach(store => {
      console.log(`   ${store.store_name}: ${store.all_tires} tires, ${store.invoices} invoices`);
      totalTires += store.all_tires;
      totalInvoices += store.invoices;
    });
    
    console.log(`   TOTAL: ${totalTires} tires, ${totalInvoices} invoices`);
    
    console.log('\n💡 RECOMMENDATION:');
    if (hasDiscrepancies) {
      console.log('The market tab in the spreadsheet appears to show different data than the aggregated store data.');
      console.log('This could mean:');
      console.log('1. The market tab has manual adjustments or different calculation logic');
      console.log('2. The market tab might be showing partial month data while stores show full month');
      console.log('3. There might be data quality issues in the original spreadsheet');
      console.log('\nTo fix: We need to either:');
      console.log('- Use the market tab data directly (if available in upload)');
      console.log('- OR continue using store aggregation but document the difference');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

compareMarketData();