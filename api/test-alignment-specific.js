const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testAlignmentSpecific() {
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  console.log('🧪 Testing: "how many alignments did akeen jackson sell so far this month in august 2025"\n');
  
  // Build context
  const context = await aiDataService.buildComprehensiveContext(1, 'how many alignments did akeen jackson sell so far this month in august 2025');
  
  console.log('1. Context Analysis:');
  console.log('- Is specific person query:', context.performance.is_specific_person_query);
  console.log('- Person name:', context.performance.specific_person_name);
  console.log('- Latest performance date:', context.performance.timeframe);
  console.log('- Latest alignments:', context.performance.latest?.alignments);
  console.log('- Store:', context.performance.store_name);
  console.log('');
  
  // Check if the AI prompt includes the alignment data
  console.log('2. AI Prompt Analysis:');
  const prompt = ollamaService.generateEnhancedPrompt('how many alignments did akeen jackson sell so far this month in august 2025', context);
  
  // Check if alignments are mentioned in the prompt
  const hasAlignmentData = prompt.includes('Alignments: 6');
  console.log('- Prompt includes alignment data:', hasAlignmentData);
  
  // Find the performance data section
  const perfSectionStart = prompt.indexOf('SPECIFIC PERSON PERFORMANCE');
  const perfSectionEnd = prompt.indexOf('**', perfSectionStart + 10);
  if (perfSectionStart > -1) {
    const perfSection = prompt.substring(perfSectionStart, perfSectionEnd > perfSectionStart ? perfSectionEnd : perfSectionStart + 500);
    console.log('\n3. Performance Section in Prompt:');
    console.log(perfSection);
  }
  
  // Check all performance records for August 2025
  console.log('\n4. All August 2025 Performance Records:');
  if (context.performance.recent_data) {
    context.performance.recent_data.forEach((record, index) => {
      const date = new Date(record.upload_date);
      if (date.getMonth() === 7 && date.getFullYear() === 2025) { // August is month 7 (0-indexed)
        console.log(`Record ${index + 1} - ${date.toLocaleDateString()} (${record.store_name}):`);
        console.log(`  Alignments: ${record.data.alignments}`);
        console.log(`  Sales: $${record.data.sales}`);
      }
    });
  }
  
  await pool.end();
}

testAlignmentSpecific();