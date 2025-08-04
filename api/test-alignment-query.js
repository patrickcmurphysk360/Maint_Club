const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testAlignmentQuery() {
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  console.log('🧪 Testing: "What are the top five advisors for alignment sales"\n');
  
  // Test context building
  console.log('1. Building AI context...');
  const context = await aiDataService.buildComprehensiveContext(1, 'what are the top five advisors for alignment sales');
  
  console.log('Context analysis:');
  console.log('- Is top performer query:', context.benchmarking.is_top_performer_query);
  console.log('- Is organizational query:', context.organizational.is_org_query);
  console.log('- Top performers found:', context.benchmarking.top_performers?.length || 0);
  
  if (context.benchmarking.top_performers && context.benchmarking.top_performers.length > 0) {
    console.log('\nTop alignment performers:');
    context.benchmarking.top_performers.forEach((performer, index) => {
      console.log(`${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value} alignments - $${performer.total_sales?.toLocaleString()}`);
    });
  }
  console.log('');
  
  // Test prompt generation
  console.log('2. Generating AI prompt...');
  const prompt = ollamaService.generateEnhancedPrompt('what are the top five advisors for alignment sales', context);
  
  console.log('Prompt includes:');
  console.log('- Top performer instruction:', prompt.includes('This is a top performer query'));
  console.log('- TOP PERFORMERS section:', prompt.includes('TOP PERFORMERS (Latest MTD)'));
  console.log('- Alignment data:', prompt.includes('alignments'));
  console.log('- Admin executive prompts:', prompt.includes('executive-level'));
  console.log('');
  
  // Show the top performers section from the prompt
  console.log('3. Key sections of the prompt:');
  const lines = prompt.split('\n');
  let inTopPerformersSection = false;
  
  lines.forEach((line, index) => {
    if (line.includes('TOP PERFORMERS')) {
      inTopPerformersSection = true;
      console.log(`Line ${index}: ${line.trim()}`);
    } else if (inTopPerformersSection && line.trim() && !line.startsWith('**')) {
      console.log(`Line ${index}: ${line.trim()}`);
    } else if (inTopPerformersSection && line.startsWith('**') && !line.includes('TOP PERFORMERS')) {
      inTopPerformersSection = false;
    }
    
    if (line.includes('SPECIAL INSTRUCTION') || line.includes('top performer query')) {
      console.log(`Line ${index}: ${line.trim()}`);
    }
  });
  
  await pool.end();
}

testAlignmentQuery();