const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testManagerQueryDetection() {
  console.log('🔍 Testing Store Manager Query Detection\n');
  
  const aiDataService = new AIDataService(pool);
  
  try {
    const query = "who is the store manager of mcdonough";
    console.log(`Query: "${query}"`);
    
    // Test manual pattern matching
    console.log('\n1. Manual Pattern Testing:');
    const lowerQuery = query.toLowerCase();
    
    // Current patterns in the code
    const storeEmployeePattern = /(who works|who is at|employees at|staff at)/;
    const rolePattern = /(managers?|advisors?|admins?|administrators?)/;
    
    console.log(`Store employee pattern: ${storeEmployeePattern.test(lowerQuery)}`);
    console.log(`Role pattern: ${rolePattern.test(lowerQuery)}`);
    
    // Test a manager-specific pattern
    const managerPattern = /(?:who\s+(?:is\s+(?:the\s+)?)?|what\s+(?:is\s+(?:the\s+)?)?)\s*(?:store\s+)?manager\s+(?:of\s+|at\s+)([a-zA-Z\s]+)/i;
    const managerMatch = lowerQuery.match(managerPattern);
    console.log(`Manager pattern match: ${managerMatch ? `"${managerMatch[1].trim()}"` : 'NO MATCH'}`);
    
    // Test AI detection
    console.log('\n2. AI Detection Test:');
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    console.log(`- Organizational query: ${context.organizational.is_org_query}`);
    console.log(`- Data found: ${context.organizational.query_specific_data?.length || 0} records`);
    
    if (context.organizational.query_specific_data) {
      context.organizational.query_specific_data.forEach(emp => {
        console.log(`  ${emp.first_name} ${emp.last_name} - ${emp.role} (${emp.store_name})`);
      });
    }
    
    // Test what the AI should find
    console.log('\n3. Direct Database Query (What AI Should Find):');
    const managerResult = await pool.query(`
      SELECT DISTINCT
        u.first_name,
        u.last_name,
        u.role,
        s.name as store_name
      FROM users u
      JOIN user_store_assignments usa ON u.id::text = usa.user_id
      JOIN stores s ON usa.store_id::integer = s.id
      WHERE LOWER(s.name) LIKE '%mcdonough%'
        AND u.role = 'store_manager'
    `);
    
    console.log(`Found ${managerResult.rows.length} store manager(s) for McDonough:`);
    managerResult.rows.forEach(manager => {
      console.log(`  ${manager.first_name} ${manager.last_name} - ${manager.role}`);
    });
    
    console.log('\n🎯 WHAT NEEDS TO BE FIXED:');
    console.log('1. Add specific store manager query detection pattern');
    console.log('2. Enhance organizational query to detect manager requests');
    console.log('3. Filter results by role when asking for specific positions');
    
    console.log('\n✅ EXPECTED AI RESPONSE:');
    console.log('**McDonough Store Manager:** John Blackerby');
    
  } catch (error) {
    console.error('❌ Error testing manager query detection:', error);
  } finally {
    await pool.end();
  }
}

testManagerQueryDetection();