// Test the exact service names returned by scorecard API
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function testServiceNames() {
  console.log('🔍 Testing exact service names returned by scorecard API...\n');
  
  try {
    const userId = 243; // John Blackerby
    const startDate = '2024-01-01';
    const endDate = '2025-07-31';
    
    // Get performance data (what API uses)
    const performanceResult = await pool.query(`
      SELECT pd.data
      FROM performance_data pd
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date BETWEEN $2 AND $3
      ORDER BY pd.upload_date DESC
    `, [userId, startDate, endDate]);
    
    console.log('📊 Raw data service fields:');
    const allServiceFields = new Set();
    performanceResult.rows.forEach(row => {
      Object.keys(row.data).forEach(key => {
        if (typeof row.data[key] === 'number' && key !== 'sales' && key !== 'invoices') {
          allServiceFields.add(key);
        }
      });
    });
    
    Array.from(allServiceFields).sort().forEach(field => {
      console.log(`  - ${field}`);
    });
    
    // Simulate what the scorecard API does
    console.log('\n🔧 Scorecard API field mapping:');
    const fieldMapping = {
      'premiumOilChange': 'Premium Oil Change',
      'fuelAdditive': 'Fuel Additive',
      'engineFlush': 'Engine Flush',
      'filters': 'Filters',
      'oilChange': 'Oil Change',
      'alignments': 'Alignments',
      'brakeService': 'Brake Service',
      'brakeFlush': 'Brake Flush',
      'engineAirFilter': 'Engine Air Filter',
      'cabinAirFilter': 'Cabin Air Filter',
      'coolantFlush': 'Coolant Flush',
      'differentialService': 'Differential Service',
      'fuelSystemService': 'Fuel System Service',
      'powerSteeringFlush': 'Power Steering Flush',
      'transmissionFluidService': 'Transmission Fluid Service',
      'battery': 'Battery',
      'allTires': 'All Tires'
    };
    
    console.log('API should return these mapped names:');
    Object.entries(fieldMapping).forEach(([field, name]) => {
      if (allServiceFields.has(field)) {
        console.log(`  ${field} -> "${name}"`);
      }
    });
    
    // Check what frontend expects
    console.log('\n🖥️  Frontend expects these exact keys:');
    const frontendExpected = [
      'Premium Oil Change',
      'Oil Change', 
      'Cabin Air Filter',
      'Engine Air Filter',
      'Coolant Flush',
      'Brake Flush',
      'Transmission Fluid Service',
      'Fuel Additive',
      'Power Steering Flush',
      'Engine Flush',
      'Alignments',
      'Battery'
    ];
    
    frontendExpected.forEach(name => console.log(`  "${name}"`));
    
    // Test the actual scorecard calculation
    console.log('\n🧪 Testing actual scorecard calculation...');
    const metrics = { services: {} };
    const serviceFields = [
      'premiumOilChange', 'fuelAdditive', 'engineFlush', 'filters',
      'oilChange', 'alignments', 'brakeService', 'brakeFlush',
      'engineAirFilter', 'cabinAirFilter', 'coolantFlush',
      'differentialService', 'fuelSystemService', 'powerSteeringFlush',
      'transmissionFluidService', 'battery', 'allTires'
    ];
    
    serviceFields.forEach(field => { metrics.services[field] = 0; });
    
    performanceResult.rows.forEach(row => {
      serviceFields.forEach(field => {
        metrics.services[field] += parseInt(row.data[field] || 0);
      });
    });
    
    // Apply field mapping like the API does
    const mappedServices = {};
    Object.entries(metrics.services).forEach(([field, count]) => {
      const serviceName = fieldMapping[field] || field;
      if (count > 0) {
        mappedServices[serviceName] = count;
      }
    });
    
    console.log('Final API response services object:');
    console.log(JSON.stringify(mappedServices, null, 2));
    
    // Check for mismatches
    console.log('\n❓ Potential issues:');
    Object.keys(mappedServices).forEach(serviceName => {
      if (!frontendExpected.includes(serviceName)) {
        console.log(`  ⚠️  API returns "${serviceName}" but frontend doesn't expect it`);
      }
    });
    
    frontendExpected.forEach(expectedName => {
      if (!mappedServices[expectedName]) {
        console.log(`  ⚠️  Frontend expects "${expectedName}" but API doesn't provide it`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing service names:', error);
  } finally {
    await pool.end();
  }
}

testServiceNames();