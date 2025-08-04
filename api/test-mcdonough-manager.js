const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testMcdonoughManager() {
  console.log('🔍 Testing McDonough Store Manager Query\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    // First, let's see what stores exist and their managers
    console.log('1. Checking all stores and their managers...');
    const storesResult = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.city,
        s.state,
        s.manager_name,
        s.manager_id,
        m.name as market_name
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE LOWER(s.name) LIKE '%mcdonough%' 
         OR LOWER(s.city) LIKE '%mcdonough%'
      ORDER BY s.name
    `);
    
    console.log(`Found ${storesResult.rows.length} McDonough-related stores:`);
    storesResult.rows.forEach(store => {
      console.log(`  ${store.name} (ID: ${store.id})`);
      console.log(`    City: ${store.city}, State: ${store.state}`);
      console.log(`    Manager Name: ${store.manager_name || 'Not Set'}`);
      console.log(`    Manager ID: ${store.manager_id || 'Not Set'}`);
      console.log(`    Market: ${store.market_name}`);
      console.log('');
    });
    
    // Check if there are users assigned to McDonough with manager role
    console.log('2. Checking users assigned to McDonough stores...');
    const usersResult = await pool.query(`
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
         OR LOWER(s.city) LIKE '%mcdonough%'
      ORDER BY u.role, u.last_name
    `);
    
    console.log(`Found ${usersResult.rows.length} users assigned to McDonough stores:`);
    usersResult.rows.forEach(user => {
      console.log(`  ${user.first_name} ${user.last_name} - ${user.role} (${user.store_name})`);
    });
    
    // Test the AI query
    console.log('\n3. Testing AI query detection...');
    const query = "who is the store manager of mcdonough";
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    console.log(`AI Detection: ${context.organizational.is_org_query ? 'ORGANIZATIONAL QUERY' : 'NOT DETECTED'}`);
    console.log(`Query Data Found: ${context.organizational.query_specific_data?.length || 0} records`);
    
    if (context.organizational.query_specific_data && context.organizational.query_specific_data.length > 0) {
      console.log('AI Found:');
      context.organizational.query_specific_data.forEach(emp => {
        console.log(`  ${emp.first_name} ${emp.last_name} - ${emp.role} (${emp.store_name})`);
      });
    }
    
    // Test different query variations
    console.log('\n4. Testing query variations...');
    const testQueries = [
      "who is the store manager of mcdonough",
      "who manages mcdonough store",
      "mcdonough store manager",
      "manager at mcdonough"
    ];
    
    for (let testQuery of testQueries) {
      const lowerQuery = testQuery.toLowerCase();
      
      // Test store manager pattern
      const managerPattern = /(?:who\s+(?:is\s+(?:the\s+)?)?|what\s+(?:is\s+(?:the\s+)?)?)\s*(?:store\s+)?manager\s+(?:of\s+|at\s+)?([a-zA-Z\s]+)/i;
      const match = lowerQuery.match(managerPattern);
      console.log(`"${testQuery}" → ${match ? `"${match[1].trim()}"` : 'NO MATCH'}`);
    }
    
    // Show what the correct AI response should be
    console.log('\n🎯 EXPECTED AI RESPONSE:');
    if (storesResult.rows.length > 0) {
      const store = storesResult.rows[0];
      if (store.manager_name) {
        console.log(`**McDonough Store Manager:** ${store.manager_name}`);
      } else {
        // Look for manager in users table
        const managers = usersResult.rows.filter(u => 
          u.role === 'store_manager' || u.role === 'manager'
        );
        if (managers.length > 0) {
          console.log(`**McDonough Store Manager:** ${managers[0].first_name} ${managers[0].last_name}`);
        } else {
          console.log('**McDonough Store Manager:** Manager information not available in system');
          console.log('**Available Staff:**');
          usersResult.rows.forEach(user => {
            console.log(`• ${user.first_name} ${user.last_name} (${user.role})`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing McDonough manager:', error);
  } finally {
    await pool.end();
  }
}

testMcdonoughManager();