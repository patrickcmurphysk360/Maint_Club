const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testAkeenFullQuery() {
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  console.log('🧪 Full test: "what is akeen jackson performance this month look like"\n');
  
  // Build context
  const context = await aiDataService.buildComprehensiveContext(1, 'what is akeen jackson performance this month look like');
  
  console.log('1. Context Analysis:');
  console.log('- User role:', context.user.role);
  console.log('- Is specific person query:', context.performance.is_specific_person_query);
  console.log('- Person name:', context.performance.specific_person_name);
  console.log('- Performance records:', context.performance.recent_data?.length || 0);
  console.log('');
  
  // Generate prompt
  console.log('2. Generated AI Prompt Key Sections:');
  const prompt = ollamaService.generateEnhancedPrompt('what is akeen jackson performance this month look like', context);
  
  const lines = prompt.split('\n');
  let inPerfSection = false;
  lines.forEach((line, index) => {
    if (line.includes('SPECIFIC PERSON PERFORMANCE') || 
        line.includes('AKEEN JACKSON') ||
        line.includes('SPECIAL INSTRUCTION FOR ADMIN')) {
      console.log(`Line ${index}: ${line.trim()}`);
      inPerfSection = true;
    } else if (inPerfSection && line.trim() && line.startsWith('- ')) {
      console.log(`Line ${index}: ${line.trim()}`);
    } else if (inPerfSection && line.includes('**') && !line.includes('PERFORMANCE')) {
      inPerfSection = false;
    }
  });
  
  console.log('\n3. Latest Performance Data Structure:');
  if (context.performance.latest) {
    Object.entries(context.performance.latest).forEach(([key, value]) => {
      console.log(`- ${key}: ${value}`);
    });
  }
  
  await pool.end();
}

testAkeenFullQuery();