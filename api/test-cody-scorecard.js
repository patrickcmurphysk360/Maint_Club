const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testCodyScorecard() {
  try {
    console.log('🔍 Testing Cody Lanier scorecard data...\n');
    
    // Get Cody's user ID
    const userResult = await pool.query(
      "SELECT id, first_name, last_name, email FROM users WHERE email = 'cody.lanier@tiresouth.com'"
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Cody Lanier not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('👤 User:', user);
    
    // Test the exact query used by scorecard API for July 2025
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data
      FROM performance_data pd
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND EXTRACT(YEAR FROM pd.upload_date) = $2
        AND EXTRACT(MONTH FROM pd.upload_date) = $3
      ORDER BY pd.upload_date DESC
      LIMIT 1
    `, [user.id, 2025, 7]);
    
    console.log('\n📊 Performance records found:', performanceResult.rows.length);
    
    if (performanceResult.rows.length > 0) {
      const data = performanceResult.rows[0].data;
      console.log('\n📅 Upload date:', performanceResult.rows[0].upload_date);
      console.log('\n🔢 Raw metrics:');
      console.log('  - invoices:', data.invoices, '(type:', typeof data.invoices, ')');
      console.log('  - sales:', data.sales, '(type:', typeof data.sales, ')');
      console.log('  - gpSales:', data.gpSales, '(type:', typeof data.gpSales, ')');
      console.log('  - avgSpend:', data.avgSpend, '(type:', typeof data.avgSpend, ')');
      
      // Test aggregation logic from scorecard.js
      const metrics = {
        invoices: 0,
        sales: 0,
        gpSales: 0
      };
      
      // This is how the API aggregates
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      console.log('\n✅ After aggregation:');
      console.log('  - invoices:', metrics.invoices);
      console.log('  - sales:', metrics.sales);
      console.log('  - gpSales:', metrics.gpSales);
      console.log('  - gpPercent:', metrics.sales > 0 ? (metrics.gpSales / metrics.sales * 100).toFixed(1) : 0);
      
      // Check for any data issues
      if (metrics.invoices === 0 && data.invoices) {
        console.log('\n⚠️  WARNING: invoices parsed to 0 but raw value is:', data.invoices);
      }
      if (metrics.sales === 0 && data.sales) {
        console.log('\n⚠️  WARNING: sales parsed to 0 but raw value is:', data.sales);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testCodyScorecard();