/**
 * Test Local API AI Chat Request for Cody Lanier
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

async function testLocalAIChatRequest() {
  console.log('🧪 Testing LOCAL API AI Chat Request for Cody Lanier');
  console.log('=' .repeat(60));
  
  try {
    // Get admin user
    const adminResult = await pool.query(`
      SELECT id, email, role FROM users 
      WHERE role IN ('admin', 'administrator') 
      LIMIT 1
    `);
    
    const adminUser = adminResult.rows[0];
    console.log(`👤 Admin User: ${adminUser.email} (${adminUser.role})`);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: adminUser.id, 
        email: adminUser.email, 
        role: adminUser.role 
      }, 
      'maintenance_club_jwt_secret_change_in_production',
      { expiresIn: '1h' }
    );
    
    // Test the AI chat endpoint with your exact query
    const chatRequest = {
      query: "show me the scorecard for cody lanier",
      model: "llama3.1:8b"
    };
    
    console.log(`🤖 AI Query: "${chatRequest.query}"`);
    console.log('🔄 Sending request to LOCAL API (port 5000)...');
    
    const response = await axios.post('http://localhost:5000/api/ai-insights/chat', chatRequest, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ AI Response received!');
    console.log('📊 Response Status:', response.status);
    console.log('🎯 AI Response:');
    console.log('=' .repeat(60));
    console.log(response.data.response);
    console.log('=' .repeat(60));
    
    // Check if validation was applied
    if (response.data.validation) {
      console.log('🛡️ Validation Info:', response.data.validation);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.response?.status);
    console.error('📝 Error Details:', error.response?.data?.message || error.message);
  } finally {
    await pool.end();
  }
}

testLocalAIChatRequest().catch(console.error);