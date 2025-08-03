const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testImprovedMatching() {
  const aiDataService = new AIDataService(pool);
  
  const testQueries = [
    'Who works at Atlanta store?',
    'Who works at Atlanta?',
    'Show me employees at Mcdonough store',
    'Who is at Covington location?'
  ];
  
  for (const query of testQueries) {
    console.log(`Testing: "${query}"`);
    const result = await aiDataService.analyzeOrganizationalQuery(query, 1);
    console.log(`Found ${result?.length || 0} employees`);
    if (result && result.length > 0) {
      result.slice(0, 2).forEach(emp => {
        console.log(`  - ${emp.first_name} ${emp.last_name} (${emp.role})`);
      });
    }
    console.log('');
  }
  
  await pool.end();
}
testImprovedMatching();