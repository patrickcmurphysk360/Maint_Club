const axios = require('axios');

async function debugBrokenAI() {
  console.log('🚨 DEBUGGING WHY AI IS STILL BROKEN...\n');
  
  try {
    // Step 1: Generate fresh admin token
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign(
      { id: 1, role: 'admin', email: 'admin@test.com' },
      'maintenance_club_jwt_secret_change_in_production',
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Generated admin token:', adminToken.substring(0, 50) + '...');
    
    // Step 2: Test scorecard API directly
    console.log('\n📊 Testing scorecard API directly...');
    const scorecardResponse = await axios.get('http://localhost:5000/api/scorecard/advisor/244', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    console.log('✅ Direct scorecard API works:');
    console.log('- User ID:', scorecardResponse.data.userId);
    console.log('- Invoices:', scorecardResponse.data.metrics.invoices);
    console.log('- Sales:', scorecardResponse.data.metrics.sales);
    console.log('- Services count:', Object.keys(scorecardResponse.data.services).length);
    
    // Step 3: Test AI endpoint with verbose logging
    console.log('\n🤖 Testing AI endpoint...');
    const aiResponse = await axios.post('http://localhost:5000/api/ai-insights/chat', {
      query: "get me cody lanier's scorecard"
    }, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('\n🎯 AI RESPONSE ANALYSIS:');
    console.log('- Response length:', aiResponse.data.response.length);
    console.log('- Contains "1234":', aiResponse.data.response.includes('1234'));
    console.log('- Contains "API failure":', aiResponse.data.response.includes('API failure'));
    console.log('- Contains real data (244):', aiResponse.data.response.includes('244'));
    console.log('- Contains real sales:', aiResponse.data.response.includes('10467') || aiResponse.data.response.includes('10,467'));
    console.log('- Validation status:', aiResponse.data.validation?.status);
    
    console.log('\n📝 FIRST 500 CHARS OF AI RESPONSE:');
    console.log(aiResponse.data.response.substring(0, 500));
    
    // Check if it contains any of the real Cody data
    const realCodyData = {
      userId: 244,
      invoices: 26,  // August data
      sales: 10467,
      alignments: 9,
      oilChange: 4,
      retailTires: 38
    };
    
    console.log('\n🔍 CHECKING FOR REAL CODY DATA:');
    for (const [key, value] of Object.entries(realCodyData)) {
      const found = aiResponse.data.response.includes(value.toString());
      console.log(`- ${key} (${value}): ${found ? '✅ FOUND' : '❌ MISSING'}`);
    }
    
    if (aiResponse.data.response.includes('1234') || aiResponse.data.response.includes('API failure')) {
      console.log('\n💥 PROBLEM CONFIRMED: AI is still using placeholder/fallback logic');
      console.log('🔧 The fixes are not being applied to the AI response generation');
    } else {
      console.log('\n✅ SUCCESS: AI is using real data');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

debugBrokenAI();