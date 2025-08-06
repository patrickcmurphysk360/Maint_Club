const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testPeriodParam() {
  const serviceToken = jwt.sign(
    { id: 1, role: 'admin', service: 'test' },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  try {
    console.log('🔍 Testing period=2025-08 parameter...');
    
    const response = await axios.get('http://localhost:5002/api/scorecard/advisor/244', {
      params: { period: '2025-08' },
      headers: { 'Authorization': `Bearer ${serviceToken}` }
    });
    
    const scorecard = response.data;
    console.log('\n📊 Results:');
    console.log(`   Sales: $${scorecard.metrics.sales}`);
    console.log(`   Invoices: ${scorecard.metrics.invoices}`);
    console.log(`   GP Sales: $${scorecard.metrics.gpSales}`);
    console.log(`   GP Percent: ${scorecard.metrics.gpPercent}%`);
    console.log(`   Retail Tires: ${scorecard.services['Retail Tires'] || 'N/A'}`);
    
    // Check if we got the expected MTD values
    if (scorecard.metrics.sales === 11183 && scorecard.metrics.invoices === 27) {
      console.log('\n✅ SUCCESS: Got correct MTD values!');
    } else {
      console.log('\n❌ FAILED: Still getting wrong values');
      console.log(`   Expected: Sales=$11,183, Invoices=27`);
      console.log(`   Got: Sales=$${scorecard.metrics.sales}, Invoices=${scorecard.metrics.invoices}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testPeriodParam().catch(console.error);