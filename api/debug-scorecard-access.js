/**
 * Debug Scorecard Data Access for Cody Lanier
 */

const { getValidatedScorecardData } = require('./utils/scorecardDataAccess');

async function debugScorecardAccess() {
  console.log('🔍 Debug Scorecard Data Access for Cody Lanier');
  console.log('=' .repeat(60));
  
  try {
    // Test the utility function directly
    console.log('📊 Testing getValidatedScorecardData utility...');
    
    const params = {
      level: 'advisor',
      id: 244, // Cody Lanier's ID
      mtdMonth: 8,
      mtdYear: 2025,
      baseURL: 'http://localhost:5002' // Ensure Docker container
    };
    
    console.log('🔧 Parameters:', JSON.stringify(params, null, 2));
    
    const result = await getValidatedScorecardData(params);
    
    console.log('✅ Scorecard Data Access Result:');
    console.log('- Success:', result.success);
    console.log('- Error:', result.error);
    console.log('- Endpoint:', result.metadata?.endpoint);
    console.log('- Source:', result.metadata?.source);
    console.log('- Data Integrity:', result.metadata?.dataIntegrity);
    
    if (result.success && result.data) {
      console.log('\n📊 Scorecard Data Structure:');
      console.log('- Advisor:', result.data.advisor || result.data.advisorName);
      console.log('- Period:', result.data.period || result.data.month);
      console.log('- Store:', result.data.store || result.data.storeName);
      console.log('- Metrics Keys:', result.data.metrics ? Object.keys(result.data.metrics) : 'None');
      console.log('- Services Keys:', result.data.services ? Object.keys(result.data.services).slice(0, 5) : 'None');
      console.log('- Goals Keys:', result.data.goals ? Object.keys(result.data.goals) : 'None');
      
      if (result.data.metrics) {
        console.log('\n💰 Sample Metrics:');
        Object.entries(result.data.metrics).slice(0, 4).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
      }
      
      if (result.data.services) {
        console.log('\n🔧 Sample Services:');
        Object.entries(result.data.services).slice(0, 4).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
      }
    } else {
      console.log('\n❌ No data returned');
      if (result.error) {
        console.log('Error Details:', result.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Direct test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugScorecardAccess().catch(console.error);