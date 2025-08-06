const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testAIResponseDebug() {
  // Create service token
  const serviceToken = jwt.sign(
    { 
      id: 1, 
      role: 'admin', 
      service: 'test-script',
      internal: true 
    },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  const baseURL = process.env.API_BASE_URL || 'http://localhost:5002';
  
  try {
    const response = await axios.post(`${baseURL}/api/ai-insights/chat`, {
      query: 'show me the scorecard for cody lanier for august 2025',
      model: 'llama3.1:8b'
    }, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 AI Response Data:');
    console.log('Success:', response.data.response ? 'Yes' : 'No');
    console.log('Response:', response.data.response);
    console.log('Context Type:', response.data.context_type);
    console.log('Validation:', response.data.validation);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAIResponseDebug().catch(console.error);