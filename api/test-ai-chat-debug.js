const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testAIChatDebug() {
  console.log('🔍 Debugging AI Chat Flow\n');
  
  // Generate admin token
  const token = jwt.sign(
    { id: 1, role: 'admin', email: 'admin@example.com' },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  const baseURL = 'http://127.0.0.1:5000';
  
  try {
    // Step 1: Check AI Health
    console.log('1️⃣ Checking AI health...');
    const healthResponse = await axios.get(`${baseURL}/api/ai-insights/health`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ AI Health:', healthResponse.data);
    
    // Step 2: Send the exact query
    console.log('\n2️⃣ Sending scorecard query...');
    const chatResponse = await axios.post(
      `${baseURL}/api/ai-insights/chat`,
      {
        query: "get me cody lanier's august 2025 scorecard",
        model: "llama3.1:8b"
      },
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Response received:');
    console.log('Query:', chatResponse.data.query);
    console.log('Context User:', chatResponse.data.context_user);
    console.log('Model Used:', chatResponse.data.model_used);
    console.log('\n📝 AI Response:');
    console.log(chatResponse.data.response);
    
    // Check if response contains correct values
    const responseText = chatResponse.data.response;
    if (responseText.includes('11,183') || responseText.includes('11183')) {
      console.log('\n🎉 SUCCESS: AI returns correct sales value!');
    } else if (responseText.includes('$0') || responseText.includes('0%')) {
      console.log('\n❌ PROBLEM: AI is still returning zeros!');
    }
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
      console.error('Details:', error);
    }
  }
}

testAIChatDebug().catch(console.error);