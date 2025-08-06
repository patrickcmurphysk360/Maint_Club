const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testJsonEchoFix() {
  console.log('🔍 Testing JSON Echo Fix for Cody Lanier August 2025...\n');
  
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
    // Test the AI Chat endpoint with Cody's scorecard query
    console.log('🤖 Testing AI Chat with JSON Echo...');
    const aiChatUrl = `${baseURL}/api/ai-insights/chat`;
    const query = 'show me the scorecard for cody lanier for august 2025';
    
    console.log(`   Query: "${query}"`);
    console.log('   Expected: Sales=$11,183, Invoices=27, Retail Tires=38\n');
    
    const response = await axios.post(aiChatUrl, {
      query: query,
      model: 'llama3.1:8b'
    }, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ AI Response:');
    console.log(response.data.response);
    console.log(`\n   Context User: ${response.data.context_user}`);
    console.log(`   Context Type: ${response.data.context_type}`);
    console.log(`   Model Used: ${response.data.model_used}`);
    
    // Check if response contains correct values
    const responseText = response.data.response;
    const hasCorrectSales = responseText.includes('11,183') || responseText.includes('11183');
    const hasCorrectInvoices = responseText.includes('27');
    const hasCorrectTires = responseText.includes('38');
    
    console.log('\n📊 Validation:');
    console.log(`   Sales $11,183: ${hasCorrectSales ? '✅' : '❌'}`);
    console.log(`   Invoices 27: ${hasCorrectInvoices ? '✅' : '❌'}`);
    console.log(`   Retail Tires 38: ${hasCorrectTires ? '✅' : '❌'}`);
    
    if (hasCorrectSales && hasCorrectInvoices && hasCorrectTires) {
      console.log('\n🎉 SUCCESS: AI is returning exact scorecard values!');
    } else {
      console.log('\n❌ FAILED: AI is still hallucinating values');
    }
    
  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
  }
}

// Run the test
testJsonEchoFix().catch(console.error);