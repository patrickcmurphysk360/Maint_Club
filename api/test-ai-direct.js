const OllamaService = require('./services/ollamaService');
const pool = require('./db');

async function testAIDirect() {
  try {
    const ollama = new OllamaService(pool);
    
    const prompt = `
You are a deterministic formatter.
Respond **ONLY** with JSON matching this schema and values:

{
  "advisor": "Cody Lanier",
  "period": "2025-08",
  "invoices": 27,
  "sales": 11183,
  "gpSales": 4858,
  "gpPercent": 44,
  "retailTires": 38,
  "allTires": 38
}
`;
    
    console.log('🤖 Testing AI with direct prompt...');
    
    const response = await ollama.generateResponse(prompt, 'llama3.1:8b', null, null, null, null, { temperature: 0 });
    
    console.log('✅ AI Response:');
    console.log(response.response);
    
    if (response.success) {
      try {
        const parsed = JSON.parse(response.response);
        console.log('\n📊 Parsed Values:');
        Object.keys(parsed).forEach(key => {
          console.log(`   ${key}: ${parsed[key]} (${typeof parsed[key]})`);
        });
      } catch (e) {
        console.log('❌ Failed to parse JSON:', e.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAIDirect().catch(console.error);