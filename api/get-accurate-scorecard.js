const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function getAccurateScorecard() {
  console.log('📊 AKEEN JACKSON - AUGUST 2025 ACCURATE SCORECARD\n');
  
  try {
    // Get all of Akeen's August 2025 performance data
    const result = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        s.name as store_name,
        m.name as market_name,
        u.first_name,
        u.last_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      LEFT JOIN markets m ON s.market_id = m.id
      LEFT JOIN users u ON pd.advisor_user_id = u.id
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 8
      ORDER BY pd.upload_date DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No August 2025 data found for Akeen Jackson');
      return;
    }
    
    console.log('=' .repeat(60));
    console.log('**AKEEN JACKSON - AUGUST 2025 MTD SCORECARD**');
    console.log('=' .repeat(60));
    
    const latestRecord = result.rows[0];
    const data = latestRecord.data;
    
    console.log(`**Advisor:** ${latestRecord.first_name} ${latestRecord.last_name}`);
    console.log(`**Store:** ${latestRecord.store_name}`);
    console.log(`**Market:** ${latestRecord.market_name}`);
    console.log(`**Period:** August 1-${new Date(latestRecord.upload_date).getDate()}, 2025`);
    console.log(`**Last Updated:** ${new Date(latestRecord.upload_date).toLocaleDateString()}`);
    
    console.log('\n**SALES PERFORMANCE**');
    console.log('-' .repeat(30));
    console.log(`• Total Sales: $${data.sales?.toLocaleString() || 'N/A'}`);
    console.log(`• Gross Profit Sales: $${data.gpSales?.toLocaleString() || 'N/A'}`);
    console.log(`• GP Percentage: ${data.gpPercent || 'N/A'}%`);
    console.log(`• Average Spend per Invoice: $${data.avgSpend || 'N/A'}`);
    console.log(`• Total Invoices: ${data.invoices || 'N/A'}`);
    
    console.log('\n**SERVICE PERFORMANCE**');
    console.log('-' .repeat(30));
    console.log(`• Alignments: ${data.alignments || 'N/A'}`);
    console.log(`• Oil Changes: ${data.oilChange || 'N/A'}`);
    console.log(`• Brake Services: ${data.brakeService || 'N/A'}`);
    console.log(`• Brake Flush: ${data.brakeFlush || 'N/A'}`);
    console.log(`• Battery Services: ${data.battery || 'N/A'}`);
    console.log(`• AC Services: ${data.acService || 'N/A'}`);
    console.log(`• Coolant Flush: ${data.coolantFlush || 'N/A'}`);
    console.log(`• Fuel System Service: ${data.fuelSystemService || 'N/A'}`);
    console.log(`• Transmission Service: ${data.transmissionFluidService || 'N/A'}`);
    console.log(`• Differential Service: ${data.differentialService || 'N/A'}`);
    console.log(`• Power Steering Flush: ${data.powerSteeringFlush || 'N/A'}`);
    console.log(`• Shocks/Struts: ${data.shocksStruts || 'N/A'}`);
    
    console.log('\n**TIRE PERFORMANCE**');
    console.log('-' .repeat(30));
    console.log(`• Retail Tires Sold: ${data.retailTires || 'N/A'}`);
    console.log(`• Total Tires: ${data.allTires || 'N/A'}`);
    console.log(`• Tire Protection Sold: ${data.tireProtection || 'N/A'}`);
    console.log(`• Tire Protection Rate: ${data.tireProtectionPercent || 'N/A'}%`);
    
    console.log('\n**FILTERS & MAINTENANCE**');
    console.log('-' .repeat(30));
    console.log(`• Engine Air Filter: ${data.engineAirFilter || 'N/A'}`);
    console.log(`• Cabin Air Filter: ${data.cabinAirFilter || 'N/A'}`);
    console.log(`• Wiper Blades: ${data.wiperBlades || 'N/A'}`);
    console.log(`• Fuel Additive: ${data.fuelAdditive || 'N/A'}`);
    console.log(`• Premium Oil Changes: ${data.premiumOilChange || 'N/A'}`);
    
    console.log('\n**OPPORTUNITY METRICS**');
    console.log('-' .repeat(30));
    console.log(`• Potential Alignments: ${data.potentialAlignments || 'N/A'}`);
    console.log(`• Potential Alignment %: ${data.potentialAlignmentsPercent || 'N/A'}%`);
    console.log(`• Alignments from Potential: ${data.potentialAlignmentsSold || 'N/A'}`);
    console.log(`• Brake Flush to Service %: ${data.brakeFlushToServicePercent || 'N/A'}%`);
    
    console.log('\n**KEY PERFORMANCE INDICATORS**');
    console.log('-' .repeat(30));
    if (data.invoices && data.sales) {
      console.log(`• Sales per Invoice: $${Math.round(data.sales / data.invoices)}`);
    }
    if (data.invoices && data.gpSales) {
      console.log(`• GP per Invoice: $${Math.round(data.gpSales / data.invoices)}`);
    }
    if (data.invoices && data.retailTires) {
      console.log(`• Tire Attachment Rate: ${Math.round((data.retailTires / data.invoices) * 100)}%`);
    }
    if (data.potentialAlignments && data.alignments) {
      console.log(`• Alignment Conversion: ${data.alignments}/${data.potentialAlignments} opportunities`);
    }
    
    // Show all records for the month
    if (result.rows.length > 1) {
      console.log('\n**MONTHLY PROGRESSION**');
      console.log('-' .repeat(30));
      result.rows.reverse().forEach((record, index) => {
        const date = new Date(record.upload_date).toLocaleDateString();
        const sales = record.data.sales || 0;
        const gp = record.data.gpPercent || 0;
        const alignments = record.data.alignments || 0;
        console.log(`${index + 1}. ${date}: $${sales.toLocaleString()} sales, ${gp}% GP, ${alignments} alignments`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error getting scorecard:', error);
  } finally {
    await pool.end();
  }
}

getAccurateScorecard();