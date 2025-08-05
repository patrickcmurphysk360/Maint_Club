const axios = require('axios');
const jwt = require('jsonwebtoken');

async function getCodyJulySales() {
  const token = jwt.sign({ id: 1, role: 'admin' }, 'maintenance_club_jwt_secret_change_in_production', { expiresIn: '1h' });
  
  try {
    console.log('Getting Cody Lanier sales for July 2025...');
    const response = await axios.get('http://localhost:5002/api/scorecard/advisor/244?mtdMonth=7&mtdYear=2025', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Cody Lanier - July 2025:');
    console.log('Sales:', `$${response.data.metrics.sales}`);
    console.log('Invoices:', response.data.metrics.invoices);
    console.log('GP Sales:', `$${response.data.metrics.gpSales}`);
    console.log('GP Percent:', `${response.data.metrics.gpPercent}%`);
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

getCodyJulySales();