const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testAIScorecardEndpoint() {
  console.log('🧪 Testing AI Scorecard Endpoint\n');
  
  const serviceToken = jwt.sign(
    { id: 1, role: 'admin', service: 'test' },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  const baseURL = 'http://localhost:5000';  // API runs on 5000, not 5002
  const headers = { 'Authorization': `Bearer ${serviceToken}` };
  
  try {
    console.log('🔍 Testing POST /api/ai-insights/scorecard with period=2025-08...');
    
    const response = await axios.post(`${baseURL}/api/ai-insights/scorecard`, {
      advisorId: 244,
      period: '2025-08'
    }, { headers });
    
    console.log('✅ Response received:', {
      status: response.status,
      advisor: response.data.advisor,
      period: response.data.period,
      sales: response.data.sales,
      invoices: response.data.invoices,
      retailTires: response.data.retailTires
    });
    
    if (response.data.sales === 11183 && response.data.invoices === 27) {
      console.log('\n🎉 SUCCESS: AI endpoint returns correct values!');
    } else {
      console.log('\n❌ FAILED: AI endpoint still returns wrong values');
      console.log(`   Expected: Sales=11,183, Invoices=27`);
      console.log(`   Got: Sales=${response.data.sales}, Invoices=${response.data.invoices}`);
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Network/Other Error:', error.message);
    }
  }
}

testAIScorecardEndpoint().catch(console.error);