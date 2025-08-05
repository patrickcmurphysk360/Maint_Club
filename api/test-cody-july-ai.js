const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testCodyJulyAI() {
  const token = jwt.sign({ id: 1, role: 'admin' }, 'maintenance_club_jwt_secret_change_in_production', { expiresIn: '1h' });
  
  try {
    console.log('Testing AI response for Cody July 2025...');
    const response = await axios.post('http://localhost:5002/api/ai-insights/chat', {
      query: 'show me cody lanier scorecard for july 2025',
      model: 'llama3.1:8b'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('AI Response for Cody July 2025:');
    console.log(response.data.response);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCodyJulyAI();