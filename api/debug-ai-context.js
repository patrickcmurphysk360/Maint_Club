const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function debugAIContext() {
  console.log('🐛 Debugging AI Context for Akeen Jackson Query\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    const query = 'show me akeen jacksons scorecard for august 2025';
    console.log(`Query: "${query}"`);
    
    // Build the context step by step
    console.log('\n1. Building AI context...');
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    console.log('\n2. Context Analysis:');
    console.log(`- Is specific person query: ${context.performance.is_specific_person_query}`);
    console.log(`- Target person: ${context.performance.specific_person_name}`);
    console.log(`- Performance records found: ${context.performance.recent_data?.length || 0}`);
    
    if (context.performance.recent_data && context.performance.recent_data.length > 0) {
      console.log('\n3. Performance Data Retrieved by AI:');
      context.performance.recent_data.forEach((record, index) => {
        const date = new Date(record.upload_date).toLocaleDateString();
        console.log(`\nRecord ${index + 1} (${date} - ${record.store_name}):`);
        if (record.data) {
          console.log(`  Sales: $${record.data.sales?.toLocaleString() || 'N/A'}`);
          console.log(`  GP Sales: $${record.data.gpSales?.toLocaleString() || 'N/A'}`);
          console.log(`  GP Percent: ${record.data.gpPercent || 'N/A'}%`);
          console.log(`  Alignments: ${record.data.alignments || 'N/A'}`);
          console.log(`  Invoices: ${record.data.invoices || 'N/A'}`);
        }
      });
    }
    
    console.log('\n4. Latest Performance Data in Context:');
    if (context.performance.latest && Object.keys(context.performance.latest).length > 0) {
      const latest = context.performance.latest;
      console.log(`Sales: $${latest.sales?.toLocaleString() || 'N/A'}`);
      console.log(`GP Sales: $${latest.gpSales?.toLocaleString() || 'N/A'}`);
      console.log(`GP Percent: ${latest.gpPercent || 'N/A'}%`);
      console.log(`Alignments: ${latest.alignments || 'N/A'}`);
      console.log(`Invoices: ${latest.invoices || 'N/A'}`);
    }
    
    // Generate the actual prompt that goes to the AI
    console.log('\n5. Generated AI Prompt Analysis:');
    const prompt = ollamaService.generateEnhancedPrompt(query, context);
    
    // Find the performance data section in the prompt
    const lines = prompt.split('\n');
    let inPerfSection = false;
    let perfLines = [];
    
    for (let line of lines) {
      if (line.includes('SPECIFIC PERSON PERFORMANCE')) {
        inPerfSection = true;
        perfLines.push(line);
      } else if (inPerfSection) {
        if (line.includes('**RECENT PERFORMANCE') || line.includes('**SPECIAL INSTRUCTION')) {
          break;
        }
        if (line.trim()) {
          perfLines.push(line);
        }
      }
    }
    
    console.log('Performance section in AI prompt:');
    perfLines.forEach(line => console.log(`  ${line}`));
    
    // Check if there's market performance data that might be confusing the AI
    console.log('\n6. Market Performance Data Check:');
    if (context.business_intelligence?.market_performance) {
      console.log('Market performance data found in context:');
      context.business_intelligence.market_performance.slice(0, 3).forEach(perf => {
        console.log(`  ${perf.market_name}: $${perf.total_sales?.toLocaleString() || 'N/A'} total sales`);
      });
    } else {
      console.log('No market performance data in context');
    }
    
    // Check top performers data
    if (context.benchmarking?.top_performers) {
      console.log('\n7. Top Performers Data Check:');
      console.log('Top performers data found in context:');
      context.benchmarking.top_performers.slice(0, 3).forEach(performer => {
        console.log(`  ${performer.advisor_name}: $${performer.total_sales?.toLocaleString() || 'N/A'}`);
      });
    } else {
      console.log('\nNo top performers data in context');
    }
    
  } catch (error) {
    console.error('❌ Error debugging AI context:', error);
  } finally {
    await pool.end();
  }
}

debugAIContext();