/**
 * Test Scorecard API Endpoint with Authentication
 */

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testScorecardEndpoint() {
  console.log('🧪 Testing Scorecard API Endpoint');
  console.log('=' .repeat(50));
  
  try {
    // First, let's get or create a valid JWT token
    // Check if there's an admin user we can use
    const adminResult = await pool.query(`
      SELECT id, email, role FROM users 
      WHERE role IN ('admin', 'administrator') 
      LIMIT 1
    `);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ No admin user found in database');
      return;
    }
    
    const adminUser = adminResult.rows[0];
    console.log(`👤 Using admin user: ${adminUser.email} (ID: ${adminUser.id})`);
    
    // Generate a JWT token manually (using the same secret as the API)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: adminUser.id, 
        email: adminUser.email, 
        role: adminUser.role 
      }, 
      'maintenance_club_jwt_secret_change_in_production', // Same as in docker-compose
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Generated JWT token');
    
    // Test both local API (port 5000) and Docker API (port 5002)
    const endpoints = [
      { name: 'Local API', baseURL: 'http://localhost:5000' },
      { name: 'Docker API', baseURL: 'http://localhost:5002' }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Testing ${endpoint.name} (${endpoint.baseURL})`);
      
      try {
        // Test health endpoint first
        const healthResponse = await axios.get(`${endpoint.baseURL}/health`, {
          timeout: 5000
        });
        console.log(`✅ Health check: ${healthResponse.data.status}`);
        
        // Test scorecard endpoint for Cody Lanier (ID: 244)
        const scorecardURL = `${endpoint.baseURL}/api/scorecard/advisor/244?mtdMonth=8&mtdYear=2025`;
        console.log(`📊 Testing: ${scorecardURL}`);
        
        const scorecardResponse = await axios.get(scorecardURL, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log(`✅ ${endpoint.name} Scorecard Response:`);
        console.log(`- Status: ${scorecardResponse.status}`);
        console.log(`- Data keys: ${Object.keys(scorecardResponse.data)}`);
        
        if (scorecardResponse.data.advisor) {
          console.log(`- Advisor: ${scorecardResponse.data.advisor}`);
          console.log(`- Metrics: ${scorecardResponse.data.metrics ? Object.keys(scorecardResponse.data.metrics) : 'None'}`);
          console.log(`- Services: ${scorecardResponse.data.services ? Object.keys(scorecardResponse.data.services).slice(0,3) : 'None'}`);
        }
        
      } catch (error) {
        console.log(`❌ ${endpoint.name} failed:`, error.response?.status, error.response?.data?.message || error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testScorecardEndpoint().catch(console.error);