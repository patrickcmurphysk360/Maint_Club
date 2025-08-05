const pool = require('./db');

async function debugCodyScorecard() {
  console.log('🔍 Debugging Cody Lanier August 2025 Scorecard...\n');
  
  try {
    // 1. Check raw performance data
    console.log('📊 Raw Performance Data for Cody (ID: 244) in August 2025:');
    const perfResult = await pool.query(`
      SELECT 
        upload_date,
        store_id,
        data->>'sales' as sales,
        data->>'invoices' as invoices,
        data->>'retailTires' as retail_tires,
        data->>'allTires' as all_tires,
        jsonb_pretty(data) as full_data
      FROM performance_data 
      WHERE advisor_user_id = '244' 
        AND EXTRACT(YEAR FROM upload_date) = 2025 
        AND EXTRACT(MONTH FROM upload_date) = 8
      ORDER BY upload_date DESC
    `);
    
    console.log(`Found ${perfResult.rows.length} records:\n`);
    perfResult.rows.forEach(row => {
      console.log(`Date: ${row.upload_date}, Store: ${row.store_id}`);
      console.log(`Sales: $${row.sales}, Invoices: ${row.invoices}, Retail Tires: ${row.retail_tires}`);
      console.log('---');
    });
    
    // 2. Test the scorecard query logic
    console.log('\n📊 Testing Scorecard Query Logic (Latest per store):');
    const scorecardResult = await pool.query(`
      WITH latest_per_store AS (
        SELECT 
          pd.upload_date,
          pd.data,
          pd.store_id,
          s.name as store_name,
          ROW_NUMBER() OVER (
            PARTITION BY pd.store_id 
            ORDER BY pd.upload_date DESC
          ) as rn
        FROM performance_data pd
        LEFT JOIN stores s ON pd.store_id::text = s.id::text
        WHERE pd.advisor_user_id = '244'
          AND pd.data_type = 'services'
          AND EXTRACT(YEAR FROM pd.upload_date) = 2025
          AND EXTRACT(MONTH FROM pd.upload_date) = 8
      )
      SELECT 
        upload_date,
        data,
        store_id,
        store_name
      FROM latest_per_store 
      WHERE rn = 1
      ORDER BY store_name
    `);
    
    console.log(`Latest records per store: ${scorecardResult.rows.length}\n`);
    
    // Calculate totals like the scorecard does
    let totalSales = 0;
    let totalInvoices = 0;
    let totalRetailTires = 0;
    
    scorecardResult.rows.forEach(row => {
      const data = row.data;
      const sales = parseFloat(data.sales || 0);
      const invoices = parseInt(data.invoices || 0);
      const retailTires = parseInt(data.retailTires || 0);
      
      totalSales += sales;
      totalInvoices += invoices;
      totalRetailTires += retailTires;
      
      console.log(`Store ${row.store_name || row.store_id}: Sales=$${sales}, Invoices=${invoices}, RetailTires=${retailTires}`);
    });
    
    console.log('\n📊 Calculated Totals:');
    console.log(`Total Sales: $${totalSales}`);
    console.log(`Total Invoices: ${totalInvoices}`);
    console.log(`Total Retail Tires: ${totalRetailTires}`);
    
    // 3. Check for data structure issues
    console.log('\n🔍 Checking data structure of latest record:');
    if (scorecardResult.rows.length > 0) {
      const sampleData = scorecardResult.rows[0].data;
      console.log('Keys in data:', Object.keys(sampleData).sort());
      console.log('\nSample values:');
      console.log(`sales: ${sampleData.sales} (type: ${typeof sampleData.sales})`);
      console.log(`invoices: ${sampleData.invoices} (type: ${typeof sampleData.invoices})`);
      console.log(`gpSales: ${sampleData.gpSales} (type: ${typeof sampleData.gpSales})`);
      console.log(`retailTires: ${sampleData.retailTires} (type: ${typeof sampleData.retailTires})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugCodyScorecard().catch(console.error);