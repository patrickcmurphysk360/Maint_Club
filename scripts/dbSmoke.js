// Usage: node scripts/dbSmoke.js 244 2025-08
const [ , , id='244', period='2025-08' ] = process.argv;
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
  
  console.log(`\n📊 Checking performance_data for advisor ${id} in ${period}:\n`);
  
  // Parse period (YYYY-MM format)
  const [year, month] = period.split('-');
  
  const res = await client.query(
    `SELECT 
       data->>'invoices' as invoices,
       data->>'sales' as sales, 
       data->>'retailTires' as retail_tires,
       upload_date,
       store_id
     FROM performance_data
     WHERE advisor_user_id = $1
       AND EXTRACT(YEAR FROM upload_date) = $2
       AND EXTRACT(MONTH FROM upload_date) = $3
     ORDER BY upload_date DESC`,
    [id, parseInt(year), parseInt(month)]
  );
  
  console.table(res.rows);
  console.log(`\nTotal rows: ${res.rows.length}`);
  
  // Show latest per store (what scorecard should use for MTD)
  if (res.rows.length > 0) {
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
    
    console.log('\n📊 Expected MTD totals (latest per store):');
    console.log(`   Invoices: ${latestTotals.invoices}`);
    console.log(`   Sales: $${latestTotals.sales.toFixed(2)}`);
    console.log(`   Retail Tires: ${latestTotals.retail_tires}`);
  }
  
  await client.end();
})().catch(console.error);