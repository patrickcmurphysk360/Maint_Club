const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function analyzeAIPrompt() {
  console.log('🔍 Analyzing AI Prompt for Hallucination Issues\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    const query = 'provide me with akeen jacksons august 2025 score card';
    console.log(`Query: "${query}"`);
    
    // Build context
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    // Generate the exact prompt sent to AI
    const prompt = ollamaService.generateEnhancedPrompt(query, context);
    
    console.log('\n📋 FULL AI PROMPT ANALYSIS:');
    console.log('=' .repeat(80));
    
    const lines = prompt.split('\n');
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Identify sections
      if (line.includes('**USER PROFILE:**')) {
        currentSection = 'USER_PROFILE';
        console.log(`\n🔵 ${line}`);
      } else if (line.includes('**PERFORMANCE DATA:**')) {
        currentSection = 'PERFORMANCE_DATA';
        console.log(`\n🟢 ${line}`);
      } else if (line.includes('**SPECIFIC PERSON PERFORMANCE:**')) {
        currentSection = 'SPECIFIC_PERSON';
        console.log(`\n🟡 ${line}`);
      } else if (line.includes('**MARKET INFORMATION:**')) {
        currentSection = 'MARKET_INFO';
        console.log(`\n🔴 ${line}`);
      } else if (line.includes('**MARKET PERFORMANCE DATA:**')) {
        currentSection = 'MARKET_PERFORMANCE';
        console.log(`\n🟠 ${line}`);
      } else if (line.includes('**USER QUERY:**')) {
        currentSection = 'USER_QUERY';
        console.log(`\n🟣 ${line}`);
      } else if (line.includes('**SPECIAL INSTRUCTION:**')) {
        currentSection = 'SPECIAL_INSTRUCTION';
        console.log(`\n⚠️ ${line}`);
      } else if (line.trim()) {
        console.log(`   ${line}`);
      }
    }
    
    console.log('\n\n🔍 POTENTIAL CONFUSION SOURCES:');
    console.log('=' .repeat(50));
    
    // Check for conflicting data in the prompt
    const promptText = prompt.toLowerCase();
    
    // Look for multiple sales figures
    const salesMatches = prompt.match(/\$[\d,]+/g);
    if (salesMatches && salesMatches.length > 1) {
      console.log('⚠️ Multiple dollar amounts found in prompt:');
      salesMatches.forEach(match => console.log(`   ${match}`));
    }
    
    // Check for market vs individual data confusion
    if (promptText.includes('market') && promptText.includes('specific person')) {
      console.log('⚠️ Both market-level and individual data present');
    }
    
    // Look for specific data points
    console.log('\n📊 KEY DATA POINTS IN PROMPT:');
    if (context.performance.latest) {
      const data = context.performance.latest;
      console.log(`✅ Individual Sales: $${data.sales?.toLocaleString()}`);
      console.log(`✅ Individual GP: ${data.gpPercent}%`);
      console.log(`✅ Individual Alignments: ${data.alignments}`);
    }
    
    if (context.business_intelligence?.market_performance) {
      const marketData = context.business_intelligence.market_performance[0];
      console.log(`⚠️ Market Total Sales: $${marketData.total_sales?.toLocaleString()}`);
      console.log(`⚠️ Market Avg GP: ${marketData.avg_gp_percent?.toFixed(1)}%`);
    }
    
    console.log('\n🎯 ROOT CAUSE ANALYSIS:');
    console.log('=' .repeat(40));
    
    if (context.business_intelligence?.market_performance) {
      console.log('❌ PROBLEM: Market performance data is included in individual queries');
      console.log('   This confuses the AI between individual vs market metrics');
    }
    
    if (context.performance.latest?.sales && context.business_intelligence?.market_performance?.[0]?.total_sales) {
      const individualSales = context.performance.latest.sales;
      const marketSales = context.business_intelligence.market_performance[0].total_sales;
      console.log(`   Individual: $${individualSales.toLocaleString()}`);
      console.log(`   Market: $${marketSales.toLocaleString()}`);
      console.log('   AI may be combining or confusing these figures');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing prompt:', error);
  } finally {
    await pool.end();
  }
}

analyzeAIPrompt();