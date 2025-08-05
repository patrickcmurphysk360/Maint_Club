const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testDockerAPI() {
  const token = jwt.sign({ id: 1, role: 'admin' }, 'maintenance_club_jwt_secret_change_in_production', { expiresIn: '1h' });
  
  try {
    console.log('Testing Docker scorecard API...');
    const response = await axios.get('http://localhost:5002/api/scorecard/advisor/244', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Docker API Response:');
    console.log('Success:', response.data.success || 'N/A');
    console.log('Metrics:', JSON.stringify(response.data.metrics || response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

testDockerAPI();