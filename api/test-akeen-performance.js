const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function getAkeenPerformance() {
  const aiDataService = new AIDataService(pool);
  
  console.log('🔍 Getting Akeen Jackson\'s performance data...\n');
  
  // First find Akeen's user ID
  const akeenUsers = await aiDataService.searchUsers('Akeen Jackson', 'name');
  console.log('Found Akeen Jackson users:');
  akeenUsers.forEach(user => {
    console.log(`- ID: ${user.id}, Name: ${user.first_name} ${user.last_name}, Store: ${user.store_name}`);
  });
  
  if (akeenUsers.length > 0) {
    const akeenId = akeenUsers[0].id;
    console.log(`\nGetting performance data for Akeen (ID: ${akeenId})...\n`);
    
    // Get Akeen's recent performance data
    const performanceData = await aiDataService.getPerformanceData(akeenId, 3);
    console.log(`Found ${performanceData.length} performance records:`);
    
    performanceData.forEach((record, index) => {
      const date = new Date(record.upload_date).toLocaleDateString();
      const data = record.data;
      console.log(`\n${index + 1}. ${date} - ${record.store_name}:`);
      console.log(`   Sales: $${data.sales?.toLocaleString() || 'N/A'}`);
      console.log(`   GP Sales: $${data.gpSales?.toLocaleString() || 'N/A'}`);
      console.log(`   GP %: ${data.gpPercent || 'N/A'}%`);
      console.log(`   Invoices: ${data.invoices || 'N/A'}`);
      console.log(`   Alignments: ${data.alignments || 'N/A'}`);
      console.log(`   Oil Changes: ${data.oilChange || 'N/A'}`);
      console.log(`   Retail Tires: ${data.retailTires || 'N/A'}`);
    });
    
    // Test comprehensive context for Akeen
    console.log('\n3. Testing AI context for Akeen performance query...');
    const context = await aiDataService.buildComprehensiveContext(1, 'what is akeen jackson performance this month look like');
    
    console.log('Context built successfully');
    console.log('User context role:', context.user.role);
    console.log('Performance data available:', context.performance.recent_data?.length || 0);
    
    if (context.performance.latest && Object.keys(context.performance.latest).length > 0) {
      console.log('Latest performance data keys:', Object.keys(context.performance.latest));
    }
  }
  
  await pool.end();
}

getAkeenPerformance();