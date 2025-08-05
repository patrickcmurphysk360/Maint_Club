const axios = require('axios');
const jwt = require('jsonwebtoken');

async function getFullData() {
  const token = jwt.sign({ id: 1, role: 'admin' }, 'maintenance_club_jwt_secret_change_in_production', { expiresIn: '1h' });
  try {
    const response = await axios.get('http://localhost:5002/api/scorecard/advisor/244?mtdMonth=7&mtdYear=2025', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Full Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
getFullData();