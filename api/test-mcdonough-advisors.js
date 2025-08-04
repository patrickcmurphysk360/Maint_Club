const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testMcdonoughAdvisors() {
  console.log('🔍 Testing McDonough Advisors Query\n');
  
  const aiDataService = new AIDataService(pool);
  
  try {
    // First, verify what advisors actually work at McDonough
    console.log('1. Actual advisors at McDonough store:');
    const advisorsResult = await pool.query(`
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.role,
        s.name as store_name
      FROM users u
      JOIN user_store_assignments usa ON u.id::text = usa.user_id
      JOIN stores s ON usa.store_id::integer = s.id
      WHERE LOWER(s.name) LIKE '%mcdonough%'
        AND u.role = 'advisor'
        AND u.status = 'active'
      ORDER BY u.last_name, u.first_name
    `);
    
    console.log(`Found ${advisorsResult.rows.length} advisors:`);
    advisorsResult.rows.forEach(advisor => {
      console.log(`  - ${advisor.first_name} ${advisor.last_name}`);
    });
    
    // Test different query variations
    console.log('\n2. Testing AI query detection:');
    const testQueries = [
      "what advisors work in mcdonough",
      "what advisors work in the mcdonough store",
      "who works at mcdonough store",
      "employees at mcdonough"
    ];
    
    for (let query of testQueries) {
      console.log(`\nQuery: "${query}"`);
      
      // Test pattern matching
      const lowerQuery = query.toLowerCase();
      
      // Current store employee pattern
      const storeEmployeePattern = /(who works|who is at|employees at|staff at)/;
      console.log(`  Store employee pattern match: ${storeEmployeePattern.test(lowerQuery)}`);
      
      // Test if "advisors" triggers detection
      const advisorPattern = /(?:what|which)\s+advisors?\s+work/i;
      console.log(`  Advisor pattern match: ${advisorPattern.test(lowerQuery)}`);
      
      // Test AI detection
      const context = await aiDataService.buildComprehensiveContext(1, query);
      console.log(`  AI Detection: ${context.organizational.is_org_query ? 'ORG QUERY' : 'NOT DETECTED'}`);
      console.log(`  Data found: ${context.organizational.query_specific_data?.length || 0} records`);
      
      if (context.organizational.query_specific_data && context.organizational.query_specific_data.length > 0) {
        console.log('  Employees found:');
        context.organizational.query_specific_data.forEach(emp => {
          console.log(`    - ${emp.first_name} ${emp.last_name} (${emp.role})`);
        });
      }
    }
    
    // Manual test of the getStoreEmployees method
    console.log('\n3. Testing getStoreEmployees method directly:');
    const storeEmployees = await aiDataService.getStoreEmployees(null, 'mcdonough');
    console.log(`Found ${storeEmployees?.length || 0} employees`);
    if (storeEmployees && storeEmployees.length > 0) {
      storeEmployees.forEach(emp => {
        console.log(`  - ${emp.first_name} ${emp.last_name} (${emp.role})`);
      });
    }
    
    console.log('\n🎯 EXPECTED AI RESPONSE:');
    console.log('**ADVISORS WORKING IN MCDONOUGH:**');
    advisorsResult.rows.forEach(advisor => {
      console.log(`• ${advisor.first_name} ${advisor.last_name}`);
    });
    console.log(`Total: ${advisorsResult.rows.length} advisors`);
    
  } catch (error) {
    console.error('❌ Error testing McDonough advisors:', error);
  } finally {
    await pool.end();
  }
}

testMcdonoughAdvisors();