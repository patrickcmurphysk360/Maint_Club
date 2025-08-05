/**
 * Test the AI agent with the Akeem/Akeen misspelling
 */

const { identifyUserFromQuery } = require('./utils/userIdentificationV2');
const pool = require('pg').Pool;

async function testAkeemMisspelling() {
  console.log('🧪 Testing Akeem/Akeen Misspelling with Real Database\n');

  // Create real database connection
  const dbPool = new pool({
    user: 'admin',
    host: 'localhost',
    database: 'maintenance_club_mvp',
    password: 'ducks2020',
    port: 5432,
  });

  // Mock current user (admin)
  const currentUser = {
    id: 1,
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@example.com',
    role: 'admin'
  };

  // Test the actual misspelled query
  const testQuery = "Provide me with the scorecard for august for Akeem Jackson";
  
  console.log(`📝 Testing query: "${testQuery}"`);
  console.log('Expected: Should find AKEEN JACKSON (ID: 250) despite "Akeem" misspelling\n');
  
  try {
    const identifiedUser = await identifyUserFromQuery(dbPool, testQuery, currentUser);
    
    console.log('\n📊 RESULT:');
    if (identifiedUser.id === 250) {
      console.log('✅ SUCCESS: Fuzzy matching worked!');
      console.log(`   Query had: "Akeem Jackson"`);
      console.log(`   Found: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
      console.log('\n🎯 The AI should now be able to get Akeen Jackson\'s scorecard data');
      console.log('   Expected result: 3 retail tires sold in August 2025');
    } else {
      console.log('❌ FAILED: Still returning wrong user');
      console.log(`   Got: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  } finally {
    await dbPool.end();
  }
}

// Run the test
testAkeemMisspelling().catch(console.error);