// Test script for organizational AI queries
// Run with: node test-organizational-ai.js

const { Pool } = require('pg');
const AIDataService = require('./services/aiDataService');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'admin',
  password: 'ducks2020'
});

async function testOrganizationalQueries() {
  const aiDataService = new AIDataService(pool);
  
  try {
    console.log('🧪 Testing Organizational AI Queries...\n');

    // Test 1: Store employee query
    console.log('1. 📍 Testing store employee query...');
    const storeEmployees = await aiDataService.getStoreEmployees(null, 'tire');
    console.log(`Found ${storeEmployees.length} employees at stores matching 'tire':`);
    storeEmployees.slice(0, 5).forEach(emp => {
      console.log(`  - ${emp.first_name} ${emp.last_name} (${emp.role}) at ${emp.store_name}`);
    });
    console.log('');

    // Test 2: Role-based search
    console.log('2. 👔 Testing role-based search...');
    const managers = await aiDataService.searchUsers('manager', 'role');
    console.log(`Found ${managers.length} managers:`);
    managers.slice(0, 5).forEach(emp => {
      console.log(`  - ${emp.first_name} ${emp.last_name} (${emp.role}) at ${emp.store_name || 'No store'}`);
    });
    console.log('');

    // Test 3: Organizational structure
    console.log('3. 🏢 Testing organizational structure...');
    const orgStructure = await aiDataService.getOrganizationalStructure();
    const roleGroups = {};
    orgStructure.forEach(emp => {
      if (!roleGroups[emp.role]) roleGroups[emp.role] = 0;
      roleGroups[emp.role]++;
    });
    
    console.log('Organizational breakdown:');
    Object.entries(roleGroups).forEach(([role, count]) => {
      console.log(`  - ${count} ${role}${count !== 1 ? 's' : ''}`);
    });
    console.log('');

    // Test 4: Query analysis
    console.log('4. 🔍 Testing query analysis...');
    const testQueries = [
      "Who works at tire south store?",
      "Show me all managers",
      "Who is John Smith?",
      "What are the sales numbers?" // Should return null for non-org query
    ];

    for (const query of testQueries) {
      console.log(`Query: "${query}"`);
      const result = await aiDataService.analyzeOrganizationalQuery(query, 1);
      if (result) {
        console.log(`  ✅ Detected organizational query - found ${result.length} results`);
      } else {
        console.log(`  ⚪ Not an organizational query`);
      }
    }
    console.log('');

    // Test 5: Comprehensive context with org query
    console.log('5. 🎯 Testing comprehensive context with org query...');
    const context = await aiDataService.buildComprehensiveContext(1, "Who works at tire south?");
    console.log(`Context built:`);
    console.log(`  - User: ${context.user.name}`);
    console.log(`  - Is org query: ${context.organizational.is_org_query}`);
    console.log(`  - Org results: ${context.organizational.query_specific_data?.length || 0} employees`);
    console.log('');

    console.log('🎉 All organizational tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the tests
testOrganizationalQueries();