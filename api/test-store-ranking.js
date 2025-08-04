const axios = require('axios');

async function testStoreRanking() {
  try {
    console.log('🧪 Testing Store Ranking Query...\n');
    
    // Step 1: Login
    console.log('🔐 Authenticating...');
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Authentication successful\n');
    
    // Step 2: Test the store ranking query
    console.log('🏆 Testing store ranking query...');
    const query = "What is the store ranking for alignments for August 2025?";
    console.log(`Query: "${query}"\n`);
    
    const aiResponse = await axios.post('http://localhost:5002/api/ai-insights/chat', {
      query: query,
      userId: 1
    }, { headers });
    
    console.log('📝 AI Response:');
    console.log('=' .repeat(70));
    console.log(aiResponse.data.response);
    console.log('=' .repeat(70));
    
    // Check validation status
    if (aiResponse.data.validation) {
      console.log('\n🛡️ Validation Status:');
      console.log(`   Overall Valid: ${aiResponse.data.validation.overallValid ? '✅ PASS' : '❌ FAIL'}`);
      if (aiResponse.data.validation.metricValidation) {
        console.log(`   Confidence Score: ${aiResponse.data.validation.metricValidation.confidenceScore}`);
      }
    }
    
    console.log('\n🎉 Store ranking test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('Error details:', error.response.data.error);
    }
  }
}

testStoreRanking();