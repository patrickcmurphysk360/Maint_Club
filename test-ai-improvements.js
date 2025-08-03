// Test script for AI improvements
// Run with: node test-ai-improvements.js

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test configuration
const TEST_CONFIG = {
  // Replace with actual admin user credentials
  email: 'admin@test.com',
  password: 'test123',
  testUserId: 1 // Replace with actual user ID
};

async function testAIImprovements() {
  try {
    console.log('🧪 Testing AI improvements...\n');

    // 1. Login to get token
    console.log('1. 🔐 Authenticating...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password
    });
    
    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Authentication successful\n');

    // 2. Check AI health
    console.log('2. 🏥 Checking AI service health...');
    const healthResponse = await axios.get(`${API_BASE}/ai-insights/health`, { headers });
    console.log('AI Health:', healthResponse.data.status);
    console.log('Available models:', healthResponse.data.models);
    console.log('');

    // 3. Initialize industry benchmarks
    console.log('3. 📊 Initializing industry benchmarks...');
    try {
      const benchmarkResponse = await axios.post(`${API_BASE}/ai-benchmarks/initialize`, {}, { headers });
      console.log('✅ Benchmarks:', benchmarkResponse.data.message);
      console.log('Count:', benchmarkResponse.data.count);
    } catch (error) {
      if (error.response?.data?.message?.includes('already initialized')) {
        console.log('✅ Benchmarks already exist');
      } else {
        throw error;
      }
    }
    console.log('');

    // 4. Test AI query with new context
    console.log('4. 🤖 Testing AI query with enhanced context...');
    const aiResponse = await axios.post(`${API_BASE}/ai-insights/chat`, {
      query: "What are the total sales for August 2025?",
      userId: TEST_CONFIG.testUserId
    }, { headers });
    
    console.log('AI Response:', aiResponse.data.response);
    console.log('Context type:', aiResponse.data.context_type || 'enhanced');
    console.log('');

    // 5. Test top performers query
    console.log('5. 🏆 Testing top performers query...');
    const topPerformersResponse = await axios.post(`${API_BASE}/ai-insights/chat`, {
      query: "Who are the top tire sales advisors for August 2025?",
      userId: TEST_CONFIG.testUserId
    }, { headers });
    
    console.log('Top Performers Response:', topPerformersResponse.data.response);
    console.log('');

    // 6. Get industry benchmarks
    console.log('6. 📈 Fetching industry benchmarks...');
    const benchmarksResponse = await axios.get(`${API_BASE}/ai-benchmarks`, { headers });
    console.log('Available benchmarks:', benchmarksResponse.data.count);
    console.log('Sample benchmark:', benchmarksResponse.data.benchmarks[0]?.title);
    console.log('');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    // Show more details for debugging
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

// Run the tests
testAIImprovements();