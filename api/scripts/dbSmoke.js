// node scripts/dbSmoke.js 244 8 2025
const [ , , advisorId, month, year ] = process.argv;
const { Client } = require('pg');

(async () => {
  const client = new Client({ 
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'maintenance_club_mvp',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'ducks2020'
  });
  
  await client.connect();
  
  console.log(`\n📊 Checking performance_data for advisor ${advisorId} in ${month}/${year}:\n`);
  
  const res = await client.query(`
    SELECT 
      upload_date,
      store_id,
      data->>'invoices' as invoices, 
      data->>'sales' as sales, 
      data->>'retailTires' as retail_tires,
      data->>'gpSales' as gp_sales,
      data->>'allTires' as all_tires
    FROM performance_data
    WHERE advisor_user_id = $1
      AND EXTRACT(YEAR FROM upload_date) = $2
      AND EXTRACT(MONTH FROM upload_date) = $3
    ORDER BY upload_date DESC
  `, [advisorId, parseInt(year), parseInt(month)]);
  
  console.table(res.rows);
  console.log(`\nTotal rows: ${res.rows.length}`);
  
  // Calculate totals
  if (res.rows.length > 0) {
    const totals = res.rows.reduce((acc, row) => {
      acc.invoices += parseInt(row.invoices || 0);
      acc.sales += parseFloat(row.sales || 0);
      acc.retail_tires += parseInt(row.retail_tires || 0);
      return acc;
    }, { invoices: 0, sales: 0, retail_tires: 0 });
    
    console.log('\n📊 Aggregated totals (all records):');
    console.log(`   Invoices: ${totals.invoices}`);
    console.log(`   Sales: $${totals.sales.toFixed(2)}`);
    console.log(`   Retail Tires: ${totals.retail_tires}`);
    
    // Show latest per store (what scorecard should use)
    console.log('\n📊 Latest record per store:');
    const latestPerStore = {};
    res.rows.forEach(row => {
      if (!latestPerStore[row.store_id] || new Date(row.upload_date) > new Date(latestPerStore[row.store_id].upload_date)) {
        latestPerStore[row.store_id] = row;
      }
    });
    
    const latestTotals = Object.values(latestPerStore).reduce((acc, row) => {
      acc.invoices += parseInt(row.invoices || 0);
      acc.sales += parseFloat(row.sales || 0);
      acc.retail_tires += parseInt(row.retail_tires || 0);
      return acc;
    }, { invoices: 0, sales: 0, retail_tires: 0 });
    
    console.log(`   Invoices: ${latestTotals.invoices}`);
    console.log(`   Sales: $${latestTotals.sales.toFixed(2)}`);
    console.log(`   Retail Tires: ${latestTotals.retail_tires}`);
  }
  
  await client.end();
})().catch(console.error);