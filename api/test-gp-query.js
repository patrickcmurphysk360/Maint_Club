const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testGPQuery() {
  const aiDataService = new AIDataService(pool);
  
  console.log('🧪 Testing: "What advisor has the highest gross profit sales in august"\n');
  
  // Test the gpSales metric directly
  console.log('1. Testing gpSales metric directly...');
  const gpResults = await aiDataService.getTopPerformers('gpSales', 'Tire South - Tekmetric', 8, 2025, 5);
  console.log('Direct gpSales query results:');
  gpResults.forEach((performer, index) => {
    const gpSales = performer.metric_value?.toLocaleString() || 'N/A';
    const totalSales = performer.total_sales?.toLocaleString() || 'N/A';
    console.log(`${index + 1}. ${performer.advisor_name} (${performer.store}): $${gpSales} GP sales - $${totalSales} total`);
  });
  console.log('');
  
  // Test the AI context building
  console.log('2. Testing AI context building...');
  const context = await aiDataService.buildComprehensiveContext(1, 'What advisor has the highest gross profit sales in august');
  console.log('AI detected as top performer query:', context.benchmarking.is_top_performer_query);
  console.log('Found performers:', context.benchmarking.top_performers?.length || 0);
  
  if (context.benchmarking.top_performers && context.benchmarking.top_performers.length > 0) {
    console.log('Top GP performers from context:');
    context.benchmarking.top_performers.forEach((performer, index) => {
      console.log(`${index + 1}. ${performer.advisor_name} (${performer.store}): $${performer.metric_value?.toLocaleString()} GP sales`);
    });
  }
  
  await pool.end();
}

testGPQuery();