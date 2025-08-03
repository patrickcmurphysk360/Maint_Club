const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testAdminAIResponse() {
  const ollamaService = new OllamaService(pool);
  
  console.log('🤖 Testing AI response for admin user...\n');
  
  // Build enhanced context for admin user
  console.log('Building enhanced context...');
  const context = await ollamaService.buildEnhancedContext(1, 'what is my role and what can I see?');
  
  console.log('Context built for:');
  console.log(`- User: ${context.user.name} (${context.user.role})`);
  console.log(`- Market: ${context.user.market || 'None'}`);
  console.log(`- Store: ${context.user.store || 'None'}`);
  console.log('');
  
  // Generate enhanced prompt to see what the AI knows
  console.log('Generating enhanced prompt...');
  const prompt = ollamaService.generateEnhancedPrompt('what is my role and what can I see?', context);
  
  console.log('AI Prompt includes:');
  console.log('- Executive-level insights:', prompt.includes('executive-level'));
  console.log('- High-level trends:', prompt.includes('high-level trends'));
  console.log('- Strategic recommendations:', prompt.includes('strategic recommendations'));
  console.log('- System-wide patterns:', prompt.includes('system-wide patterns'));
  console.log('- Admin User name:', prompt.includes('Admin User'));
  console.log('- Administrator role:', prompt.includes('administrator'));
  console.log('');
  
  // Show key parts of the prompt
  console.log('Key prompt sections:');
  const lines = prompt.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('USER PROFILE') || 
        line.includes('Admin User') || 
        line.includes('administrator') ||
        line.includes('executive-level') ||
        line.includes('Tire South')) {
      console.log(`Line ${index}: ${line.trim()}`);
    }
  });
  
  await pool.end();
}

testAdminAIResponse();