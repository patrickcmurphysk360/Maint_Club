/**
 * Test Admin AI Chat Request for Cody Lanier
 * Simulates the exact flow when admin requests scorecard
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

async function testAdminAIChatRequest() {
  console.log('🧪 Testing Admin AI Chat Request for Cody Lanier');
  console.log('=' .repeat(60));
  
  try {
    // Get admin user
    const adminResult = await pool.query(`
      SELECT id, email, role FROM users 
      WHERE role IN ('admin', 'administrator') 
      LIMIT 1
    `);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ No admin user found');
      return;
    }
    
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
    console.log('🔄 Sending request to Docker API...');
    
    const response = await axios.post('http://localhost:5002/api/ai-insights/chat', chatRequest, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout for AI processing
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
    
    // Check response metadata
    if (response.data.model) {
      console.log('🤖 Model Used:', response.data.model);
    }
    
    if (response.data.timestamp) {
      console.log('⏰ Response Time:', response.data.timestamp);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.response?.status);
    console.error('📝 Error Details:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.error('🔍 Full Error Response:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await pool.end();
  }
}

testAdminAIChatRequest().catch(console.error);