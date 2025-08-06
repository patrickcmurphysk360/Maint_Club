const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testScorecardFix() {
  console.log('🧪 Testing Scorecard API Fix\n');
  
  const serviceToken = jwt.sign(
    { id: 1, role: 'admin', service: 'test' },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  const baseURL = 'http://localhost:5002';
  const headers = { 'Authorization': `Bearer ${serviceToken}` };
  
  try {
    // Test 1: period=2025-08 parameter
    console.log('Test 1: period=2025-08 parameter');
    const response1 = await axios.get(`${baseURL}/api/scorecard/advisor/244`, {
      params: { period: '2025-08' },
      headers
    });
    
    console.log(`✅ Sales: $${response1.data.metrics.sales} (expected: $11,183)`);
    console.log(`✅ Invoices: ${response1.data.metrics.invoices} (expected: 27)`);
    console.log(`✅ Retail Tires: ${response1.data.services['Retail Tires']} (expected: 38)\n`);
    
    // Test 2: mtdMonth/mtdYear parameters (should give same result)
    console.log('Test 2: mtdMonth=8&mtdYear=2025 parameters');
    const response2 = await axios.get(`${baseURL}/api/scorecard/advisor/244`, {
      params: { mtdMonth: 8, mtdYear: 2025 },
      headers
    });
    
    console.log(`✅ Sales: $${response2.data.metrics.sales} (expected: $11,183)`);
    console.log(`✅ Invoices: ${response2.data.metrics.invoices} (expected: 27)\n`);
    
    // Test 3: Compare results
    console.log('Test 3: Comparing both approaches');
    const match = (
      response1.data.metrics.sales === response2.data.metrics.sales &&
      response1.data.metrics.invoices === response2.data.metrics.invoices &&
      response1.data.services['Retail Tires'] === response2.data.services['Retail Tires']
    );
    
    console.log(`✅ Results match: ${match ? 'YES' : 'NO'}\n`);
    
    // Test 4: Verify we get the expected exact values
    console.log('Test 4: Verify exact expected values');
    const correctValues = (
      response1.data.metrics.sales === 11183 &&
      response1.data.metrics.invoices === 27 &&
      response1.data.services['Retail Tires'] === 38
    );
    
    console.log(`✅ Correct values: ${correctValues ? 'YES' : 'NO'}\n`);
    
    if (correctValues && match) {
      console.log('🎉 ALL TESTS PASSED - Fix is working correctly!');
    } else {
      console.log('❌ SOME TESTS FAILED - Fix needs more work');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testScorecardFix().catch(console.error);