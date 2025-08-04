const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testCodyPatterns() {
  console.log('🔍 Testing Pattern Matching for Cody Lanier Query\n');
  
  const query = "what is cody lanier's total retail tires sold for august 2025";
  console.log(`Query: "${query}"`);
  
  const lowerQuery = query.toLowerCase();
  console.log(`Lowercase: "${lowerQuery}"`);
  
  try {
    // Test each pattern from the aiDataService
    console.log('\n📋 PATTERN TESTING:');
    
    // Pattern 1: what/how [person] performance
    let match1 = lowerQuery.match(/(?:what\s+(?:is|does|are)|how\s+(?:is|does|are))\s+([a-zA-Z\s]+?)(?:'s|\s+)(?:performance|doing|sales|numbers)/i);
    console.log(`1. Performance pattern: ${match1 ? `"${match1[1]}"` : 'NO MATCH'}`);
    
    // Pattern 2: how many/much [metric] did [person] sell
    let match2 = lowerQuery.match(/how\s+(?:many|much)\s+\w+\s+(?:did|does|has)\s+([a-zA-Z\s]+?)\s+(?:sell|have|complete|do)/i);
    console.log(`2. How many pattern: ${match2 ? `"${match2[1]}"` : 'NO MATCH'}`);
    
    // Pattern 3: [person]'s [metric] - THIS SHOULD MATCH!
    let match3 = lowerQuery.match(/([a-zA-Z\s]+?)(?:'s|s')\s+(?:sales|performance|numbers|alignments|tires|revenue)/i);
    console.log(`3. Possessive pattern: ${match3 ? `"${match3[1]}"` : 'NO MATCH'}`);
    
    // Pattern 4: show/give me [person] scorecard
    let match4 = lowerQuery.match(/(?:show\s+(?:me\s+)?|give\s+(?:me\s+)?|get\s+(?:me\s+)?)([a-zA-Z\s]+?)(?:s)?\s+(?:[\d\s,]+\s+)?(?:complete\s+)?(?:scorecard|score\s+card|metrics|performance|breakdown|service\s+metrics|full\s+performance)/i);
    console.log(`4. Scorecard pattern: ${match4 ? `"${match4[1]}"` : 'NO MATCH'}`);
    
    // Pattern 5: provide [person] scorecard
    let match5 = lowerQuery.match(/(?:provide\s+(?:me\s+(?:with\s+)?)?)\s*([a-zA-Z\s]+?)(?:s)?\s+(?:[\d\s,]+\s+)?(?:complete\s+)?(?:scorecard|score\s+card|metrics|performance|breakdown)/i);
    console.log(`5. Provide pattern: ${match5 ? `"${match5[1]}"` : 'NO MATCH'}`);
    
    // Pattern 6: all of [person] [metrics]
    let match6 = lowerQuery.match(/(?:all\s+(?:of\s+)?|what\s+are\s+(?:all\s+(?:of\s+)?)?)\s*([a-zA-Z\s]+?)\s+(?:service\s+)?(?:metrics|numbers|performance|sales)/i);
    console.log(`6. All of pattern: ${match6 ? `"${match6[1]}"` : 'NO MATCH'}`);
    
    // Pattern 7: [person] tire sales
    let match7 = lowerQuery.match(/(?:show\s+)?([a-zA-Z\s]+?)\s+(?:tire\s+sales|alignments|services)/i);
    console.log(`7. Tire sales pattern: ${match7 ? `"${match7[1]}"` : 'NO MATCH'}`);
    
    // Pattern 8: simple [person] [performance terms]
    let match8 = lowerQuery.match(/^([a-zA-Z\s]+?)\s+(?:performance|scorecard|score\s+card|metrics|sales|data)\b/i);
    console.log(`8. Simple pattern: ${match8 ? `"${match8[1]}"` : 'NO MATCH'}`);
    
    console.log('\n🔍 ANALYSIS:');
    console.log('The query "what is cody lanier\'s total retail tires sold" should match pattern 3 (possessive)');
    console.log('Expected match: "cody lanier" from "([a-zA-Z\\s]+?)(?:\'s|s\')\\s+(?:...tires...)"');
    
    // Test a more specific pattern for this case
    console.log('\n🧪 TESTING ENHANCED PATTERN:');
    let enhancedMatch = lowerQuery.match(/(?:what\s+(?:is|are))\s+([a-zA-Z\s]+?)(?:'s|s')\s+(?:total\s+)?(?:retail\s+)?(?:tires?|alignments?|sales|performance)/i);
    console.log(`Enhanced possessive pattern: ${enhancedMatch ? `"${enhancedMatch[1]}"` : 'NO MATCH'}`);
    
  } catch (error) {
    console.error('❌ Error testing patterns:', error);
  } finally {
    await pool.end();
  }
}

testCodyPatterns();