// Test scorecard API response
const axios = require('axios');

async function testScorecard() {
    try {
        // Test Akeem's scorecard for July 2025
        const response = await axios.get('http://localhost:5002/api/scorecard/advisor/250', {
            params: {
                mtdMonth: 7,
                mtdYear: 2025
            },
            headers: {
                'Authorization': 'Bearer test'
            }
        });

        const services = response.data.services;
        
        console.log('\n=== Akeem Jackson - July 2025 Scorecard ===\n');
        console.log('Brake Service:', services['Brake Service']);
        console.log('Brake Flush:', services['Brake Flush']);
        console.log('Brake Flush to Service %:', services['Brake Flush to Service %']);
        console.log('\nTire Protection:', services['Tire Protection']);
        console.log('Tire Protection %:', services['Tire Protection %']);
        console.log('\nRetail Tires:', services['Retail Tires']);
        
        // Check if fields are being confused
        console.log('\n=== Checking for field confusion ===');
        Object.entries(services).forEach(([key, value]) => {
            if (key.includes('Brake') || key.includes('Tire') && key.includes('%')) {
                console.log(`${key}: ${value}`);
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testScorecard();