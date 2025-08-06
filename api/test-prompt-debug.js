const pool = require('./db');

async function debugPrompt() {
  try {
    const AIDataService = require('./services/aiDataService');
    const { getValidatedScorecardData } = require('./utils/scorecardDataAccess');
    
    const aiDataService = new AIDataService(pool);
    
    // Get scorecard data for Cody
    const scorecardResult = await getValidatedScorecardData({
      level: 'advisor',
      id: 244,
      mtdMonth: 8,
      mtdYear: 2025
    });
    
    console.log('📊 Scorecard Data Structure:');
    console.log('Success:', scorecardResult.success);
    if (scorecardResult.data) {
      console.log('Metrics:', scorecardResult.data.metrics);
      console.log('Services (first 5):', Object.entries(scorecardResult.data.services).slice(0, 5));
      
      // Test prompt building
      console.log('\n📝 Testing Prompt Builder:');
      const prompt = aiDataService.buildScorecardJsonPrompt('Cody Lanier', '2025-08', scorecardResult.data);
      console.log(prompt);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugPrompt().catch(console.error);