const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testStoreHistoryFix() {
  console.log('🔍 Testing Enhanced Store History Detection\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    const query = "what stores did akeen jackson work at during july 2025";
    console.log(`Query: "${query}"`);
    
    // Build comprehensive context
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    console.log('\n✅ CONTEXT ANALYSIS:');
    console.log(`- Organizational query detected: ${context.organizational.is_org_query}`);
    console.log(`- Query specific data found: ${context.organizational.query_specific_data?.length || 0} records`);
    
    if (context.organizational.query_specific_data && context.organizational.query_specific_data.length > 0) {
      console.log('\n📊 STORE HISTORY DATA FOUND:');
      context.organizational.query_specific_data.forEach((record, index) => {
        console.log(`${index + 1}. ${record.store_name} (${record.city}, ${record.state})`);
        console.log(`   Market: ${record.market_name}`);
        console.log(`   Records: ${record.performance_records} performance entries`);
        console.log(`   Period: ${record.first_record} to ${record.last_record}`);
        if (record.timeframe) {
          console.log(`   Timeframe: ${record.timeframe}`);
        }
      });
    } else {
      console.log('❌ No store history data found');
    }
    
    // Generate AI prompt
    const prompt = ollamaService.generateEnhancedPrompt(query, context);
    
    console.log('\n📋 AI PROMPT ANALYSIS:');
    
    // Check if the prompt contains store history information
    const hasOrgResults = prompt.includes('ORGANIZATIONAL QUERY RESULTS');
    console.log(`✅ Organizational results section: ${hasOrgResults}`);
    
    if (hasOrgResults) {
      // Look for store names in the prompt
      const storeNames = ['Atlanta', 'Marietta Blvd', 'Mcdonough'];
      const storesInPrompt = storeNames.filter(store => prompt.includes(store));
      console.log(`✅ Stores mentioned in prompt: ${storesInPrompt.join(', ')}`);
    }
    
    console.log('\n🎯 EXPECTED AI RESPONSE:');
    console.log('**AKEEN JACKSON - JULY 2025 STORE HISTORY**');
    console.log('• Atlanta');
    console.log('• Marietta Blvd'); 
    console.log('• Mcdonough');
    console.log('Total: 3 different stores');
    
    // Test the pattern matching manually
    console.log('\n🧪 PATTERN MATCHING TEST:');
    const lowerQuery = query.toLowerCase();
    const storeHistoryPattern = /what stores\s+(?:did|does)\s+([a-zA-Z\s]+?)\s+work\s+at(?:\s+during|\s+in)?/;
    const match = lowerQuery.match(storeHistoryPattern);
    console.log(`Pattern match: ${match ? `"${match[1]}"` : 'NO MATCH'}`);
    
    // Test timeframe extraction
    const monthMatch = lowerQuery.includes('july') ? 7 : null;
    const yearMatch = lowerQuery.match(/20\d{2}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;
    console.log(`Timeframe extracted: ${monthMatch}/${year}`);
    
  } catch (error) {
    console.error('❌ Error testing store history fix:', error);
  } finally {
    await pool.end();
  }
}

testStoreHistoryFix();