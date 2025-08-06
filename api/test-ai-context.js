const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');

async function testAIContext() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'maintenance_club_mvp',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'ducks2020'
  });

  try {
    console.log('🔍 Testing AI Context Building\n');
    
    const ollama = new OllamaService(pool);
    
    // Test 1: Build context for Cody (ID 244)
    console.log('1️⃣ Building enhanced context for Cody Lanier (ID 244)...');
    const context = await ollama.buildEnhancedContext(244, "get me cody lanier's august 2025 scorecard");
    
    console.log('\n📊 Context Built:');
    console.log('User:', context.user);
    console.log('Performance Data Available:', !!context.performance);
    console.log('Validated Data:', context.performance?.validated_data);
    console.log('Business Intelligence:', context.business_intelligence);
    
    if (context.performance?.validated_data?.data) {
      console.log('\n✅ Scorecard Data Found:');
      console.log('Sales:', context.performance.validated_data.data.metrics?.sales);
      console.log('Invoices:', context.performance.validated_data.data.metrics?.invoices);
    } else {
      console.log('\n❌ No scorecard data in context!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAIContext().catch(console.error);