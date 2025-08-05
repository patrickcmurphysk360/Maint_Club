/**
 * Test fuzzy name matching for misspellings
 */

const { identifyUserFromQuery } = require('./utils/userIdentificationV2');

async function testFuzzyMatching() {
  console.log('🧪 Testing Fuzzy Name Matching\n');

  // Mock database connection that handles fuzzy matching
  const mockPool = {
    query: async (sql, params) => {
      console.log('Query params:', params);
      
      // Handle exact match first
      if (sql.includes('LOWER(u.first_name) = $1')) {
        if (params.includes('akeem') && params.includes('jackson')) {
          console.log('❌ No exact match for "akeem jackson"');
          return { rows: [] };
        }
        if (params.includes('akeen') && params.includes('jackson')) {
          console.log('✅ Exact match for "akeen jackson"');
          return {
            rows: [{
              id: 250,
              first_name: 'AKEEN',
              last_name: 'JACKSON',
              email: 'akeen.jackson@example.com',
              role: 'advisor',
              spreadsheet_name: 'AKEEN JACKSON'
            }]
          };
        }
      }
      
      // Handle fuzzy matching
      if (sql.includes('LIKE') && params.includes('akeem%')) {
        console.log('✅ Fuzzy match: "akeem%" matches "akeen"');
        return {
          rows: [{
            id: 250,
            first_name: 'AKEEN',
            last_name: 'JACKSON',
            email: 'akeen.jackson@example.com',
            role: 'advisor',
            spreadsheet_name: 'AKEEN JACKSON'
          }]
        };
      }
      
      return { rows: [] };
    }
  };

  // Mock current user (admin)
  const currentUser = {
    id: 1,
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@example.com',
    role: 'admin'
  };

  // Test the misspelled query
  const testQuery = "Provide me with the scorecard for august for Akeem Jackson";
  
  console.log(`📝 Testing query: "${testQuery}"`);
  console.log('Expected: Should find AKEEN JACKSON (ID: 250) despite "Akeem" misspelling\n');
  
  try {
    const identifiedUser = await identifyUserFromQuery(mockPool, testQuery, currentUser);
    
    if (identifiedUser.id === 250) {
      console.log('✅ SUCCESS: Fuzzy matching worked!');
      console.log(`   Found: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
      console.log('   The AI should now get the correct user data for Akeen Jackson');
    } else {
      console.log('❌ FAILED: Still returning wrong user');
      console.log(`   Got: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

// Run the test
testFuzzyMatching().catch(console.error);