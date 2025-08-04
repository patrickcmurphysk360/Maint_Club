const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testPatternMatching() {
  console.log('🔍 Testing Pattern Matching for Different Query Formats\n');
  
  const aiDataService = new AIDataService(pool);
  
  const testQueries = [
    'provide me with akeen jacksons august 2025 score card',
    'show me akeen jackson scorecard for august 2025',
    'akeen jackson performance august 2025',
    'akeen jackson scorecard august',
    'get akeen jackson metrics',
    'provide akeen jackson scorecard'
  ];
  
  try {
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n${i + 1}. Testing: "${query}"`);
      
      // Test the pattern matching manually
      const lowerQuery = query.toLowerCase();
      
      // Test each pattern from the code
      console.log('   Pattern tests:');
      
      // Pattern 1: what/how [person] performance
      let match1 = lowerQuery.match(/(?:what\s+(?:is|does|are)|how\s+(?:is|does|are))\s+([a-zA-Z\s]+?)(?:'s|\s+)(?:performance|doing|sales|numbers)/i);
      console.log(`   ✓ Performance pattern: ${match1 ? `"${match1[1]}"` : 'NO MATCH'}`);
      
      // Pattern 2: how many/much [metric] did [person] sell
      let match2 = lowerQuery.match(/how\s+(?:many|much)\s+\w+\s+(?:did|does|has)\s+([a-zA-Z\s]+?)\s+(?:sell|have|complete|do)/i);
      console.log(`   ✓ How many pattern: ${match2 ? `"${match2[1]}"` : 'NO MATCH'}`);
      
      // Pattern 3: [person]'s [metric]
      let match3 = lowerQuery.match(/([a-zA-Z\s]+?)(?:'s|s')\s+(?:sales|performance|numbers|alignments|tires|revenue)/i);
      console.log(`   ✓ Possessive pattern: ${match3 ? `"${match3[1]}"` : 'NO MATCH'}`);
      
      // Pattern 4: show/give me [person] scorecard
      let match4 = lowerQuery.match(/(?:show\s+(?:me\s+)?|give\s+(?:me\s+)?|get\s+(?:me\s+)?)([a-zA-Z\s]+?)(?:s)?\s+(?:complete\s+)?(?:scorecard|metrics|performance|breakdown|service\s+metrics|full\s+performance)/i);
      console.log(`   ✓ Scorecard pattern: ${match4 ? `"${match4[1]}"` : 'NO MATCH'}`);
      
      // Pattern 5: provide [person] scorecard
      let match5 = lowerQuery.match(/(?:provide\s+(?:me\s+(?:with\s+)?)?)\s*([a-zA-Z\s]+?)\s+(?:complete\s+)?(?:scorecard|metrics|performance|breakdown)/i);
      console.log(`   ✓ Provide pattern: ${match5 ? `"${match5[1]}"` : 'NO MATCH'}`);
      
      // Build actual context to see what happens
      const context = await aiDataService.buildComprehensiveContext(1, query);
      console.log(`   ✅ AI Detection: ${context.performance.is_specific_person_query ? `"${context.performance.specific_person_name}"` : 'NOT DETECTED'}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing patterns:', error);
  } finally {
    await pool.end();
  }
}

testPatternMatching();