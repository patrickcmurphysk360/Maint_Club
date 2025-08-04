const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function verifyAkeenData() {
  console.log('🔍 Verifying Akeen Jackson\'s Actual Data vs AI Response\n');
  
  try {
    // Get Akeen's actual data for August 2025
    const result = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        s.name as store_name,
        u.first_name,
        u.last_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      LEFT JOIN users u ON pd.advisor_user_id = u.id
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 8
      ORDER BY pd.upload_date DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No data found for Akeen Jackson in August 2025');
      return;
    }
    
    const actualData = result.rows[0];
    const data = actualData.data;
    
    console.log('📊 ACTUAL DATABASE DATA:');
    console.log(`Name: ${actualData.first_name} ${actualData.last_name}`);
    console.log(`Store: ${actualData.store_name}`);
    console.log(`Date: ${new Date(actualData.upload_date).toLocaleDateString()}`);
    console.log(`Total Sales: $${data.sales?.toLocaleString() || 'N/A'}`);
    console.log(`GP Sales: $${data.gpSales?.toLocaleString() || 'N/A'}`);
    console.log(`GP Percent: ${data.gpPercent || 'N/A'}%`);
    console.log(`Invoices: ${data.invoices || 'N/A'}`);
    console.log(`Alignments: ${data.alignments || 'N/A'}`);
    console.log(`Retail Tires: ${data.retailTires || 'N/A'}`);
    console.log(`Average Spend: $${data.avgSpend || 'N/A'}`);
    
    console.log('\n🤖 AI RESPONSE COMPARISON:');
    console.log('AI Said: Total Sales: $23,450');
    console.log(`Actual:  Total Sales: $${data.sales?.toLocaleString()}`);
    console.log(`Match: ${data.sales === 23450 ? '✅' : '❌'}`);
    
    console.log('\nAI Said: Average GP: 52.8%');
    console.log(`Actual:  GP Percent: ${data.gpPercent}%`);
    console.log(`Match: ${data.gpPercent === 52.8 ? '✅' : '❌'}`);
    
    // Check if there are multiple records that might sum to $23,450
    console.log('\n📈 ALL AUGUST RECORDS:');
    const allRecords = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data,
        s.name as store_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      LEFT JOIN users u ON pd.advisor_user_id = u.id
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 8
      ORDER BY pd.upload_date DESC
    `);
    
    let totalSales = 0;
    let totalGP = 0;
    let recordCount = 0;
    
    allRecords.rows.forEach((record, index) => {
      const date = new Date(record.upload_date).toLocaleDateString();
      const sales = record.data.sales || 0;
      const gp = record.data.gpPercent || 0;
      
      console.log(`${index + 1}. ${date}: $${sales.toLocaleString()} sales, ${gp}% GP`);
      
      totalSales += sales;
      totalGP += gp;
      recordCount++;
    });
    
    const avgGP = recordCount > 0 ? (totalGP / recordCount).toFixed(1) : 0;
    
    console.log('\n📊 CALCULATED TOTALS:');
    console.log(`Total Sales (sum): $${totalSales.toLocaleString()}`);
    console.log(`Average GP: ${avgGP}%`);
    console.log(`Records: ${recordCount}`);
    
    console.log('\n🔍 ANALYSIS:');
    if (totalSales === 23450) {
      console.log('✅ AI used sum of all August records for total sales');
    } else if (actualData.data.sales === 23450) {
      console.log('✅ AI used latest record data');
    } else {
      console.log('❌ Sales figures do not match - possible data source discrepancy');
      console.log(`   AI: $23,450 vs Actual Latest: $${actualData.data.sales} vs Sum: $${totalSales}`);
    }
    
    if (parseFloat(avgGP) === 52.8) {
      console.log('✅ AI correctly calculated average GP across records');
    } else if (actualData.data.gpPercent === 52.8) {
      console.log('✅ AI used latest record GP percentage');
    } else {
      console.log('❌ GP percentage does not match');
      console.log(`   AI: 52.8% vs Actual Latest: ${actualData.data.gpPercent}% vs Average: ${avgGP}%`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying data:', error);
  } finally {
    await pool.end();
  }
}

verifyAkeenData();