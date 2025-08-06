const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testChatEndpointScorecard() {
  console.log('🧪 Testing AI Chat Endpoint with Scorecard Query\n');
  
  const serviceToken = jwt.sign(
    { id: 1, role: 'admin', service: 'test' },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  const baseURL = 'http://localhost:5000';  // Local development port
  const headers = { 'Authorization': `Bearer ${serviceToken}` };
  
  try {
    console.log('🔍 Testing POST /api/ai-insights/chat with scorecard query...');
    
    const response = await axios.post(`${baseURL}/api/ai-insights/chat`, {
      query: "get me cody lanier's scorecard for august 2025"
    }, { headers });
    
    console.log('✅ Response received:');
    console.log('Query:', response.data.query);
    console.log('Response:', response.data.response);
    console.log('Context User:', response.data.context_user);
    console.log('Model:', response.data.model_used);
    
    // Check if the response contains the correct values
    const responseText = response.data.response;
    if (responseText.includes('11,183') || responseText.includes('11183')) {
      console.log('\n🎉 SUCCESS: Chat endpoint returns correct sales value!');
    } else {
      console.log('\n❌ FAILED: Chat endpoint still returns wrong values');
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Network/Other Error:', error.message);
    }
  }
}

testChatEndpointScorecard().catch(console.error);