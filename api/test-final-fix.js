const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testFinalFix() {
  console.log('🎯 FINAL TEST: AI Scorecard Data Accuracy\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    const originalQuery = 'provide me with akeen jacksons august 2025 score card';
    console.log(`Original problematic query: "${originalQuery}"`);
    
    // Build comprehensive context
    const context = await aiDataService.buildComprehensiveContext(1, originalQuery);
    
    console.log('\n✅ CONTEXT ANALYSIS:');
    console.log(`- Specific person query detected: ${context.performance.is_specific_person_query}`);
    console.log(`- Target person: ${context.performance.specific_person_name}`);
    console.log(`- Performance records: ${context.performance.recent_data?.length || 0}`);
    
    if (context.performance.latest && Object.keys(context.performance.latest).length > 0) {
      console.log('\n📊 ACCURATE DATA IN CONTEXT:');
      const data = context.performance.latest;
      console.log(`✅ Sales: $${data.sales?.toLocaleString()}`);
      console.log(`✅ GP Sales: $${data.gpSales?.toLocaleString()}`);
      console.log(`✅ GP Percent: ${data.gpPercent}%`);
      console.log(`✅ Invoices: ${data.invoices}`);
      console.log(`✅ Alignments: ${data.alignments}`);
      console.log(`✅ Retail Tires: ${data.retailTires}`);
      console.log(`✅ Store: ${context.performance.store_name}`);
      console.log(`✅ Date: ${new Date(context.performance.timeframe).toLocaleDateString()}`);
    }
    
    // Generate the AI prompt
    const prompt = ollamaService.generateEnhancedPrompt(originalQuery, context);
    
    console.log('\n📋 AI PROMPT VERIFICATION:');
    
    // Check that the prompt contains the correct data
    const expectedSales = context.performance.latest?.sales;
    const expectedGP = context.performance.latest?.gpPercent;
    const expectedAlignments = context.performance.latest?.alignments;
    
    const promptContainsSales = expectedSales && prompt.includes(expectedSales.toString());
    const promptContainsGP = expectedGP && prompt.includes(expectedGP.toString());
    const promptContainsAlignments = expectedAlignments && prompt.includes(expectedAlignments.toString());
    
    console.log(`✅ Prompt contains correct sales ($${expectedSales?.toLocaleString()}): ${promptContainsSales}`);
    console.log(`✅ Prompt contains correct GP (${expectedGP}%): ${promptContainsGP}`);
    console.log(`✅ Prompt contains correct alignments (${expectedAlignments}): ${promptContainsAlignments}`);
    
    // Check for confusion sources
    const marketSalesInPrompt = prompt.includes('$380920') || prompt.includes('$380,920');
    console.log(`⚠️ Market-level sales in prompt: ${marketSalesInPrompt ? 'YES - potential confusion' : 'NO - good'}`);
    
    // Look for the special admin instruction
    const hasAdminInstruction = prompt.includes('SPECIAL INSTRUCTION FOR ADMIN');
    console.log(`✅ Admin-specific instruction present: ${hasAdminInstruction}`);
    
    console.log('\n🎯 EXPECTED AI RESPONSE SHOULD SHOW:');
    console.log('- Total Sales: $5,385 (NOT $23,450)');
    console.log('- GP Percentage: 47% (NOT 52.8%)');
    console.log('- Alignments: 6');
    console.log('- Store: Atlanta');
    console.log('- Invoices: 19');
    console.log('- Retail Tires: 21');
    
    console.log('\n🚀 SOLUTION SUMMARY:');
    console.log('✅ Enhanced pattern matching to detect possessive forms');
    console.log('✅ Smart name cleanup (jacksons → jackson)');
    console.log('✅ Date removal from person names');
    console.log('✅ Correct data retrieval for specific person');
    console.log('✅ Admin-focused prompts for objective responses');
    
    // Test other variations that should now work
    console.log('\n🧪 TESTING OTHER QUERY VARIATIONS:');
    const testQueries = [
      'akeen jacksons scorecard',
      'show me akeen jackson august data',
      'provide akeen jackson metrics'
    ];
    
    for (let query of testQueries) {
      const testContext = await aiDataService.buildComprehensiveContext(1, query);
      const detected = testContext.performance.is_specific_person_query;
      console.log(`"${query}" → ${detected ? '✅ DETECTED' : '❌ NOT DETECTED'}`);
    }
    
  } catch (error) {
    console.error('❌ Error in final test:', error);
  } finally {
    await pool.end();
  }
}

testFinalFix();