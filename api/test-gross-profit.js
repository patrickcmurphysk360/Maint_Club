const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function checkGrossProfitData() {
  const aiDataService = new AIDataService(pool);
  
  console.log('🔍 Checking gross profit sales data...\n');
  
  // Check what fields are available for gross profit
  const sampleData = await pool.query(`
    SELECT data 
    FROM performance_data 
    WHERE data IS NOT NULL 
    LIMIT 3
  `);
  
  console.log('Sample performance data fields related to profit/sales:');
  sampleData.rows.forEach((row, index) => {
    const data = row.data;
    const allFields = Object.keys(data);
    const profitFields = allFields.filter(k => 
      k.toLowerCase().includes('profit') || 
      k.toLowerCase().includes('gp') ||
      k.toLowerCase().includes('gross') ||
      k.toLowerCase().includes('sales')
    );
    console.log(`Record ${index + 1}:`, profitFields);
    
    // Show actual values for these fields
    if (profitFields.length > 0) {
      console.log('  Values:', profitFields.map(f => `${f}: ${data[f]}`).join(', '));
    }
  });
  
  console.log('\n2. Testing different gross profit metrics...');
  
  // Test different possible field names for gross profit
  const testMetrics = ['sales', 'grossProfit', 'gpPercent', 'gross_profit', 'gp'];
  
  for (const metric of testMetrics) {
    try {
      console.log(`\nTesting metric: "${metric}"`);
      const topPerformers = await aiDataService.getTopPerformers(metric, 'Tire South - Tekmetric', 8, 2025, 3);
      if (topPerformers.length > 0) {
        console.log(`✅ Found ${topPerformers.length} performers for ${metric}:`);
        topPerformers.forEach((performer, index) => {
          console.log(`  ${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value} - $${performer.total_sales?.toLocaleString() || 'N/A'}`);
        });
      } else {
        console.log(`❌ No data found for metric: ${metric}`);
      }
    } catch (error) {
      console.log(`❌ Error with metric "${metric}":`, error.message);
    }
  }
  
  // Test the AI context building for gross profit query
  console.log('\n3. Testing AI query detection...');
  const context = await aiDataService.buildComprehensiveContext(1, 'What advisor has the highest gross profit sales in august');
  console.log('Query detected as top performer query:', context.benchmarking.is_top_performer_query);
  console.log('Top performers found:', context.benchmarking.top_performers?.length || 0);
  
  if (context.benchmarking.top_performers && context.benchmarking.top_performers.length > 0) {
    console.log('Top performers data:');
    context.benchmarking.top_performers.forEach((performer, index) => {
      console.log(`  ${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value}`);
    });
  }
  
  await pool.end();
}

checkGrossProfitData();