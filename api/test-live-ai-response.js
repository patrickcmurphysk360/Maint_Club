const { Pool } = require('pg');
const { ollamaService } = require('./services/ollamaService');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testLiveAIResponse() {
  try {
    console.log('🤖 TESTING LIVE AI RESPONSE FOR AKEEN JACKSON...\n');
    
    // This is exactly what happens when you ask the AI in the interface
    const userQuery = "provide me the scorecard for akeen jackson";
    const adminUserId = 1; // Admin user
    
    console.log(`📝 Query: "${userQuery}"`);
    console.log(`👤 Admin User ID: ${adminUserId}\n`);
    
    // Call the actual AI service that processes your requests
    console.log('🔄 Calling AI service (this is what actually runs when you ask)...\n');
    
    const aiResponse = await ollamaService.processAIRequest(
      userQuery,
      adminUserId,
      pool
    );
    
    console.log('✅ AI RESPONSE RECEIVED:\n');
    console.log('=' .repeat(80));
    console.log(aiResponse);
    console.log('=' .repeat(80));
    
    // Verify it contains the expected data
    const hasAkeenData = aiResponse.includes('AKEEN') || aiResponse.includes('Akeen');
    const hasScorecard = aiResponse.includes('scorecard') || aiResponse.includes('Scorecard');
    const hasMetrics = aiResponse.includes('invoices') || aiResponse.includes('Invoices') || aiResponse.includes('sales') || aiResponse.includes('Sales');
    
    console.log('\n📊 VALIDATION RESULTS:');
    console.log(`- Contains Akeen data: ${hasAkeenData ? '✅' : '❌'}`);
    console.log(`- Contains scorecard info: ${hasScorecard ? '✅' : '❌'}`);
    console.log(`- Contains performance metrics: ${hasMetrics ? '✅' : '❌'}`);
    
    const isSuccessful = hasAkeenData && hasScorecard && hasMetrics;
    console.log(`\n🎯 OVERALL RESULT: ${isSuccessful ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (isSuccessful) {
      console.log('\n🎉 THE AI IS NOW WORKING CORRECTLY!');
      console.log('   You should get proper scorecard responses in the interface.');
    } else {
      console.log('\n❌ STILL BROKEN - Need to investigate further');
    }
    
  } catch (error) {
    console.error('❌ LIVE TEST FAILED:', error);
    console.log('\n🚨 The AI is still broken. Error details:');
    console.log('Message:', error.message);
    console.log('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testLiveAIResponse();