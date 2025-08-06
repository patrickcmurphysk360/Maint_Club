const { getValidatedScorecardData } = require('./utils/scorecardDataAccess');
const jwt = require('jsonwebtoken');

async function testScorecardUtility() {
  console.log('🧪 Testing Scorecard Utility Directly\n');
  
  // Set up environment for testing
  process.env.JWT_SECRET = 'maintenance_club_jwt_secret_change_in_production';
  
  try {
    console.log('1️⃣ Testing direct scorecard utility call...');
    const result = await getValidatedScorecardData({
      level: 'advisor',
      id: 244,
      mtdMonth: 8,
      mtdYear: 2025
    });
    
    console.log('✅ Scorecard data retrieved:');
    console.log('Success:', result.success);
    console.log('Data:', JSON.stringify(result.data, null, 2));
    console.log('Metadata:', result.metadata);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
  }
}

testScorecardUtility().catch(console.error);