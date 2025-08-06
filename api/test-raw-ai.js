const pool = require('./db');
const AIDataService = require('./services/aiDataService');
const { getValidatedScorecardData } = require('./utils/scorecardDataAccess');
const OllamaService = require('./services/ollamaService');

async function testRawAI() {
  try {
    const aiDataService = new AIDataService(pool);
    const ollama = new OllamaService(pool);
    
    // Get scorecard data for Cody
    const scorecardResult = await getValidatedScorecardData({
      level: 'advisor',
      id: 244,
      mtdMonth: 8,
      mtdYear: 2025
    });
    
    const prompt = aiDataService.buildScorecardJsonPrompt('Cody Lanier', '2025-08', scorecardResult.data);
    
    console.log('📝 Prompt:');
    console.log(prompt);
    console.log('\n🤖 AI Response:');
    
    const response = await ollama.generateResponse(prompt, 'llama3.1:8b', null, null, null, null, { temperature: 0 });
    
    console.log('Raw response:', JSON.stringify(response.response));
    console.log('Response length:', response.response.length);
    console.log('First 100 chars:', response.response.substring(0, 100));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testRawAI().catch(console.error);