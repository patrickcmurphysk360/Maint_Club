const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testEnhancedAkeen() {
  const aiDataService = new AIDataService(pool);
  
  console.log('🧪 Testing enhanced Akeen store history queries...\n');
  
  const testQueries = [
    'what stores has akeen worked in',
    'what stores has akeen from tire south worked in',
    'show me akeen store history',
    'where has akeen jackson worked'
  ];
  
  for (const query of testQueries) {
    console.log(`Testing: "${query}"`);
    const result = await aiDataService.analyzeOrganizationalQuery(query, 1);
    
    if (result && result.length > 0) {
      console.log(`✅ Found ${result.length} store assignments:`);
      result.forEach(assignment => {
        const assignedDate = assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'Unknown';
        const perfSummary = assignment.performance_records > 0 
          ? `${assignment.performance_records} performance records` 
          : 'No performance data';
        console.log(`  - ${assignment.store_name} (${assignment.market_name}) - Assigned: ${assignedDate} - ${perfSummary}`);
      });
    } else {
      console.log('❌ No organizational query detected or no results found');
    }
    console.log('');
  }
  
  // Test comprehensive context building
  console.log('Testing comprehensive context with store history query...');
  const context = await aiDataService.buildComprehensiveContext(1, 'what stores has akeen worked in');
  console.log(`Context org query detected: ${context.organizational.is_org_query}`);
  console.log(`Org results: ${context.organizational.query_specific_data?.length || 0} store assignments`);
  
  if (context.organizational.query_specific_data && context.organizational.query_specific_data.length > 0) {
    console.log('Store history found in context:');
    context.organizational.query_specific_data.forEach(assignment => {
      console.log(`  - ${assignment.first_name} ${assignment.last_name} worked at ${assignment.store_name}`);
    });
  }
  
  await pool.end();
}

testEnhancedAkeen();