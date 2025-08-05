/**
 * Test Live Cody Lanier Scorecard Request
 * Exactly simulating your frontend request
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testLiveCodyRequest() {
  console.log('🧪 Testing LIVE Cody Lanier Scorecard Request');
  console.log('=' .repeat(60));
  
  try {
    // Get admin user (simulating you as admin)
    const adminResult = await pool.query(`
      SELECT id, email, role FROM users 
      WHERE role IN ('admin', 'administrator') 
      LIMIT 1
    `);
    
    const adminUser = adminResult.rows[0];
    console.log(`👤 Admin User: ${adminUser.email} (${adminUser.role})`);
    
    // Generate JWT token (same as frontend would have)
    const token = jwt.sign(
      { 
        id: adminUser.id, 
        email: adminUser.email, 
        role: adminUser.role 
      }, 
      'maintenance_club_jwt_secret_change_in_production',
      { expiresIn: '1h' }
    );
    
    // Your exact request from frontend
    const chatRequest = {
      query: "show me cody lanier scorecard",
      model: "llama3.1:8b"
    };
    
    console.log(`🤖 Query: "${chatRequest.query}"`);
    console.log('🔄 Making request to Docker API (port 5002)...');
    
    const startTime = Date.now();
    const response = await axios.post('http://localhost:5002/api/ai-insights/chat', chatRequest, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000 // 45 second timeout
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log('✅ Response received!');
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log('📊 Status:', response.status);
    console.log('');
    console.log('🎯 AI RESPONSE:');
    console.log('=' .repeat(60));
    console.log(response.data.response);
    console.log('=' .repeat(60));
    
    // Check response metadata
    if (response.data.validation) {
      console.log('\n🛡️ Validation:', response.data.validation);
    }
    
    if (response.data.model) {
      console.log('🤖 Model:', response.data.model);
    }
    
    // Check if it contains real data or "no data" message
    const hasRealData = response.data.response.includes('$') || 
                       response.data.response.includes('invoices') ||
                       response.data.response.includes('oil change') ||
                       response.data.response.includes('alignment');
    
    const hasNoDataMessage = response.data.response.includes('No validated scorecard data');
    
    console.log('\n📈 Analysis:');
    console.log('- Contains real metrics:', hasRealData);
    console.log('- Shows "no data" message:', hasNoDataMessage);
    
    if (hasRealData) {
      console.log('🎉 SUCCESS: Real scorecard data is being shown!');
    } else if (hasNoDataMessage) {
      console.log('❌ ISSUE: Still showing "no data" despite fixes');
    } else {
      console.log('🤔 UNKNOWN: Response format unexpected');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.response?.status);
    console.error('📝 Error:', error.response?.data?.message || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Connection refused - Docker container may not be running');
    }
  } finally {
    await pool.end();
  }
}

testLiveCodyRequest().catch(console.error);