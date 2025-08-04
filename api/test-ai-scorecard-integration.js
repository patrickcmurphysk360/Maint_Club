const axios = require('axios');

async function testAIScorecardIntegration() {
  try {
    console.log('🧪 Testing AI Scorecard Integration...');
    
    // Step 1: Login
    console.log('🔐 Authenticating...');
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Authentication successful');
    
    // Step 2: Test direct scorecard API
    console.log('\n📊 Testing direct scorecard API...');
    const scorecardResponse = await axios.get('http://localhost:5002/api/scorecard/advisor/1?mtdMonth=8&mtdYear=2025', { headers });
    console.log('✅ Scorecard API Response:');
    console.log(`   Alignments: ${scorecardResponse.data.services.Alignments}`);
    console.log(`   Sales: $${scorecardResponse.data.metrics.sales}`);
    console.log(`   Invoices: ${scorecardResponse.data.metrics.invoices}`);
    
    // Step 3: Test AI query with validation
    console.log('\n🤖 Testing AI query with validation...');
    const aiResponse = await axios.post('http://localhost:5002/api/ai-insights/chat', {
      query: "What are my alignment sales for August 2025?",
      userId: 1
    }, { headers });
    
    console.log('✅ AI Response received:');
    console.log(`   Length: ${aiResponse.data.response.length} characters`);
    console.log(`   Context Type: ${aiResponse.data.context_type}`);
    
    // Check for validation metadata
    if (aiResponse.data.validation) {
      console.log('🛡️ Validation Results:');
      console.log(`   Field Validation: ${aiResponse.data.validation.fieldValidation?.isValid ? 'PASS' : 'FAIL'}`);
      console.log(`   Metric Validation: ${aiResponse.data.validation.metricValidation?.isValid ? 'PASS' : 'FAIL'}`);
      console.log(`   Overall Valid: ${aiResponse.data.validation.overallValid ? 'PASS' : 'FAIL'}`);
      
      if (aiResponse.data.validation.metricValidation) {
        console.log(`   Confidence Score: ${aiResponse.data.validation.metricValidation.confidenceScore}`);
        console.log(`   Mismatches: ${aiResponse.data.validation.metricValidation.mismatchCount}`);
      }
    } else {
      console.log('⚠️ No validation metadata found');
    }
    
    console.log('\n📝 AI Response Content:');
    console.log('=' .repeat(60));
    console.log(aiResponse.data.response);
    console.log('=' .repeat(60));
    
    // Step 4: Test validation dashboard
    console.log('\n📊 Testing validation dashboard...');
    try {
      const dashboardResponse = await axios.get('http://localhost:5002/api/ai-validation/stats', { headers });
      console.log('✅ Validation Dashboard Working:');
      console.log(`   Total Validations: ${dashboardResponse.data.summary.total_validations}`);
      console.log(`   Pass Rate: ${dashboardResponse.data.summary.pass_rate_percent}%`);
      console.log(`   Avg Confidence: ${dashboardResponse.data.summary.avg_confidence_score}`);
    } catch (error) {
      console.log('❌ Validation dashboard error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n🎉 AI Scorecard Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAIScorecardIntegration();