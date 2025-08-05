const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testDockerAPIWithDate() {
  const token = jwt.sign({ id: 1, role: 'admin' }, 'maintenance_club_jwt_secret_change_in_production', { expiresIn: '1h' });
  
  try {
    console.log('Testing Docker scorecard API with MTD date (August 2025)...');
    const response = await axios.get('http://localhost:5002/api/scorecard/advisor/244?mtdMonth=8&mtdYear=2025', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Docker API Response (MTD August 2025):');
    console.log('Metrics:', JSON.stringify(response.data.metrics || response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

testDockerAPIWithDate();