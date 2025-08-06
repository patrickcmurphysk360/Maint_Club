const axios = require('axios');
const jwt = require('jsonwebtoken');

async function getCodyScorecard() {
  // Create service token
  const serviceToken = jwt.sign(
    { 
      id: 1, 
      role: 'admin', 
      service: 'scorecard-request',
      internal: true 
    },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
  
  try {
    const response = await axios.get('http://localhost:5002/api/scorecard/advisor/244', {
      params: {
        mtdMonth: 8,
        mtdYear: 2025
      },
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const scorecard = response.data;
    
    console.log('📊 Cody Lanier - August 2025 Scorecard\n');
    
    // Basic Metrics
    console.log('🎯 Core Metrics:');
    console.log(`   Sales: $${scorecard.metrics.sales.toLocaleString()}`);
    console.log(`   GP Sales: $${scorecard.metrics.gpSales.toLocaleString()}`);
    console.log(`   GP Percent: ${scorecard.metrics.gpPercent}%`);
    console.log(`   Invoices: ${scorecard.metrics.invoices}`);
    console.log(`   Avg Spend: $${scorecard.services['Avg. Spend'].toFixed(2)}\n`);
    
    // Key Services
    console.log('🔧 Key Services:');
    console.log(`   Oil Changes: ${scorecard.services['Oil Change']}`);
    console.log(`   Alignments: ${scorecard.services['Alignments']}`);
    console.log(`   Brake Service: ${scorecard.services['Brake Service']}`);
    console.log(`   Retail Tires: ${scorecard.services['Retail Tires']} units`);
    console.log(`   All Tires: ${scorecard.services['All Tires']} units\n`);
    
    // Performance Percentages
    console.log('📈 Performance Rates:');
    console.log(`   Tire Protection %: ${scorecard.services['Tire Protection %']}%`);
    console.log(`   Potential Alignments %: ${scorecard.services['Potential Alignments %']}%`);
    console.log(`   Brake Flush to Service %: ${scorecard.services['Brake Flush to Service %']}%\n`);
    
    // Additional Services
    console.log('🛠️  Other Services:');
    const otherServices = [
      'Tire Balance', 'Tire Rotation', 'Coolant Flush', 'Fuel System Service',
      'Brake Flush', 'Tire Protection'
    ];
    
    otherServices.forEach(service => {
      if (scorecard.services[service] > 0) {
        console.log(`   ${service}: ${scorecard.services[service]}`);
      }
    });
    
    console.log(`\n📅 Period: August 2025`);
    console.log(`🏪 Store: Mcdonough (Store ID: 57)`);
    console.log(`🎯 Market: Tire South - Tekmetric`);
    
  } catch (error) {
    console.error('❌ Error fetching scorecard:', error.response?.data || error.message);
  }
}

getCodyScorecard().catch(console.error);