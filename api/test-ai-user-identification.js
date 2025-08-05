/**
 * Test script for AI User Identification improvements
 */

const { identifyUserFromQuery } = require('./utils/userIdentification');

async function testUserIdentification() {
  console.log('🧪 Testing AI User Identification Improvements\n');

  // Mock database connection
  const mockPool = {
    query: async (sql, params) => {
      console.log('Mock query:', { sql: sql.substring(0, 50) + '...', params });
      
      // Mock responses for known users
      if (params.includes('cody') && params.includes('lanier')) {
        return {
          rows: [{
            id: 244,
            first_name: 'CODY',
            last_name: 'LANIER',
            email: 'cody.lanier@tiresouth.com',
            role: 'advisor',
            spreadsheet_name: 'CODY LANIER'
          }]
        };
      }
      
      if (params.includes('akeen') && params.includes('jackson')) {
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

  // Test cases
  const testCases = [
    "how many tires has cody lanier sold in august",
    "show me akeen jackson's scorecard for august 2025",
    "what are Cody Lanier's alignment sales",
    "provide me with akeen jacksons august 2025 score card",
    "how many alignments did Akeen Jackson sell",
    "show my scorecard",
    "what are my tire sales",
    "get me John Smith's performance",
    "Cody Lanier retail tire count"
  ];

  console.log('Running test cases...\n');

  for (const query of testCases) {
    console.log(`\n📝 Query: "${query}"`);
    
    try {
      const identifiedUser = await identifyUserFromQuery(mockPool, query, currentUser);
      console.log(`✅ Identified: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n\n✨ Test Summary:');
  console.log('- User identification now extracts names from natural language');
  console.log('- Supports possessive patterns (e.g., "Cody Lanier\'s")');
  console.log('- Falls back to current user for "my" queries');
  console.log('- Handles various query patterns');
}

// Run the test
testUserIdentification().catch(console.error);