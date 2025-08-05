const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testCodyAugustScorecard() {
  console.log('🔍 Testing Cody Lanier August 2025 Scorecard...\n');
  
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
    // Test 1: Direct scorecard API
    console.log('📊 Test 1: Direct Scorecard API');
    const scorecardUrl = `${baseURL}/api/scorecard/advisor/244?mtdMonth=8&mtdYear=2025`;
    console.log(`   URL: ${scorecardUrl}`);
    
    try {
      const scorecardResponse = await axios.get(scorecardUrl, {
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Scorecard API Response:');
      console.log(`   Sales: $${scorecardResponse.data.sales || 0}`);
      console.log(`   GP Sales: $${scorecardResponse.data.gpSales || 0}`);
      console.log(`   GP Percent: ${scorecardResponse.data.gpPercent || 0}%`);
      console.log(`   Invoices: ${scorecardResponse.data.invoices || 0}`);
      console.log(`   Retail Tires: ${scorecardResponse.data.retailTires || 0}`);
      console.log(`   All Tires: ${scorecardResponse.data.allTires || 0}`);
      console.log(`   Services Count: ${Object.keys(scorecardResponse.data.services || {}).length}`);
      console.log();
    } catch (error) {
      console.error('❌ Scorecard API Error:', error.response?.data || error.message);
    }
    
    // Test 2: AI Chat endpoint
    console.log('🤖 Test 2: AI Chat Endpoint');
    const aiChatUrl = `${baseURL}/api/ai-insights/chat`;
    const aiQuery = 'show me the scorecard for cody lanier for august 2025';
    console.log(`   Query: "${aiQuery}"`);
    
    try {
      const aiResponse = await axios.post(aiChatUrl, {
        query: aiQuery,
        model: 'llama3.1:8b'
      }, {
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ AI Response:');
      console.log(aiResponse.data.response.substring(0, 500) + '...');
      console.log(`\n   Context User: ${aiResponse.data.context_user}`);
      console.log(`   Context Type: ${aiResponse.data.context_type}`);
      console.log(`   Model Used: ${aiResponse.data.model_used}`);
    } catch (error) {
      console.error('❌ AI Chat Error:', error.response?.data || error.message);
    }
    
    // Test 3: Check scorecard data access utility
    console.log('\n📋 Test 3: Scorecard Data Access Utility');
    const { getValidatedScorecardData } = require('./utils/scorecardDataAccess');
    
    try {
      const scorecardResult = await getValidatedScorecardData({
        level: 'advisor',
        id: 244,
        mtdMonth: 8,
        mtdYear: 2025
      });
      
      console.log('✅ Utility Response:');
      console.log(`   Success: ${scorecardResult.success}`);
      console.log(`   Has Data: ${!!scorecardResult.data}`);
      if (scorecardResult.data) {
        console.log(`   Sales: $${scorecardResult.data.sales || 0}`);
        console.log(`   Invoices: ${scorecardResult.data.invoices || 0}`);
      }
      console.log(`   Metadata: ${JSON.stringify(scorecardResult.metadata, null, 2)}`);
    } catch (error) {
      console.error('❌ Utility Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// Run the test
testCodyAugustScorecard().catch(console.error);