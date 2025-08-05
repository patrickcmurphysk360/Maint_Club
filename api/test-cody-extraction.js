const { Pool } = require('pg');
const AIDataService = require('./services/aiDataService');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testCodyExtraction() {
  try {
    const aiDataService = new AIDataService(pool);
    const query = 'show me cody lanier scorecard';
    
    console.log('Testing query:', query);
    
    const isPerformance = aiDataService.detectPerformanceIntent(query);
    console.log('Performance intent detected:', isPerformance);
    
    const lowerQuery = query.toLowerCase();
    
    let personPerfMatch = lowerQuery.match(/show\s+me\s+([a-zA-Z\s]+?)\s+scorecard/i);
    console.log('Pattern match:', personPerfMatch ? personPerfMatch[1] : 'No match');
    
    if (personPerfMatch) {
      let personName = personPerfMatch[1].trim();
      console.log('Extracted name:', personName);
      
      const results = await aiDataService.searchUsers(personName, 'name');
      console.log('Search results:', results.length);
      if (results.length > 0) {
        console.log('Found:', results[0].first_name, results[0].last_name, 'ID:', results[0].id);
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

testCodyExtraction();