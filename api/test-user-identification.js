const { identifyUserFromQuery } = require('./utils/userIdentificationV2');
const { Pool } = require('pg');

async function testUserIdentification() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'maintenance_club_mvp',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'ducks2020'
  });

  try {
    console.log('🔍 Testing User Identification\n');
    
    const queries = [
      "get me cody lanier's august 2025 scorecard",
      "show me cody lanier's scorecard",
      "what are cody lanier's sales",
      "cody lanier scorecard"
    ];
    
    const requestingUser = { id: 1, role: 'admin' };
    
    for (const query of queries) {
      console.log(`\nQuery: "${query}"`);
      try {
        const identifiedUser = await identifyUserFromQuery(pool, query, requestingUser);
        console.log(`✅ Identified: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
      } catch (error) {
        console.log(`❌ Failed to identify user: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testUserIdentification().catch(console.error);