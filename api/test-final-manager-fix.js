const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testFinalManagerFix() {
  console.log('🎯 Final Test: Store Manager Query Fix\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    const query = "who is the store manager of mcdonough";
    console.log(`Query: "${query}"`);
    
    // Build comprehensive context
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    console.log('\n✅ CONTEXT ANALYSIS:');
    console.log(`- Organizational query detected: ${context.organizational.is_org_query}`);
    console.log(`- Query specific data found: ${context.organizational.query_specific_data?.length || 0} records`);
    
    if (context.organizational.query_specific_data && context.organizational.query_specific_data.length > 0) {
      console.log('\n📊 MANAGER DATA FOUND:');
      context.organizational.query_specific_data.forEach((manager, index) => {
        console.log(`${index + 1}. ${manager.first_name} ${manager.last_name}`);
        console.log(`   Role: ${manager.role}`);
        console.log(`   Store: ${manager.store_name} (${manager.city}, ${manager.state})`);
        console.log(`   Market: ${manager.market_name}`);
      });
    }
    
    // Generate AI prompt to verify data inclusion
    const prompt = ollamaService.generateEnhancedPrompt(query, context);
    
    console.log('\n📋 AI PROMPT VERIFICATION:');
    const hasOrgResults = prompt.includes('ORGANIZATIONAL QUERY RESULTS');
    const hasJohnBlackerby = prompt.includes('JOHN BLACKERBY');
    const hasMcdonough = prompt.includes('Mcdonough');
    
    console.log(`- Organizational results section: ${hasOrgResults}`);
    console.log(`- John Blackerby mentioned: ${hasJohnBlackerby}`);
    console.log(`- McDonough store mentioned: ${hasMcdonough}`);
    
    console.log('\n🎯 EXPECTED AI RESPONSE:');
    console.log('**McDonough Store Manager:** John Blackerby');
    console.log('- Role: Store Manager');
    console.log('- Store: McDonough');
    console.log('- Market: Tire South - Tekmetric');
    
    // Test multiple manager query variations
    console.log('\n🧪 TESTING OTHER MANAGER QUERY VARIATIONS:');
    const testQueries = [
      "who manages mcdonough store",
      "mcdonough store manager", 
      "manager at mcdonough",
      "who is the store manager for atlanta"
    ];
    
    for (let testQuery of testQueries) {
      console.log(`\nTesting: "${testQuery}"`);
      const testContext = await aiDataService.buildComprehensiveContext(1, testQuery);
      const hasData = testContext.organizational.query_specific_data?.length > 0;
      
      if (hasData) {
        const managers = testContext.organizational.query_specific_data;
        console.log(`✅ Found ${managers.length} manager(s): ${managers.map(m => m.first_name + ' ' + m.last_name).join(', ')}`);
      } else {
        console.log('❌ No managers found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error in final manager test:', error);
  } finally {
    await pool.end();
  }
}

testFinalManagerFix();