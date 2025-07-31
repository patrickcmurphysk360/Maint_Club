// Test the scorecard endpoint directly
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function testScorecardEndpoint() {
  try {
    console.log('🔍 Testing scorecard endpoint logic...\n');
    
    // Test for user 243 (John Blackerby) who we know has data
    const userId = 243;
    const startDate = '2024-01-01';
    const endDate = '2025-07-31';
    
    console.log(`Testing for user ${userId}...`);
    
    // Get performance data for this advisor
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.data
      FROM performance_data pd
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date BETWEEN $2 AND $3
      ORDER BY pd.upload_date DESC
    `, [userId, startDate, endDate]);
    
    console.log(`✅ Found ${performanceResult.rows.length} performance records`);
    
    if (performanceResult.rows.length === 0) {
      console.log('❌ No performance data found - this explains empty scorecards');
      return;
    }
    
    // Calculate aggregated metrics
    const metrics = {
      invoices: 0,
      sales: 0,
      gpSales: 0,
      services: {}
    };
    
    // Service fields to track
    const serviceFields = [
      'premiumOilChange', 'fuelAdditive', 'engineFlush', 'filters',
      'oilChange', 'alignments', 'brakeService', 'brakeFlush',
      'engineAirFilter', 'cabinAirFilter', 'coolantFlush',
      'differentialService', 'fuelSystemService', 'powerSteeringFlush',
      'transmissionFluidService', 'battery', 'allTires'
    ];
    
    // Initialize service counters
    serviceFields.forEach(field => {
      metrics.services[field] = 0;
    });
    
    // Aggregate data
    performanceResult.rows.forEach(row => {
      const data = row.data;
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      serviceFields.forEach(field => {
        metrics.services[field] += parseInt(data[field] || 0);
      });
    });
    
    // Calculate GP%
    metrics.gpPercent = metrics.sales > 0 ? (metrics.gpSales / metrics.sales) * 100 : 0;
    
    console.log('\n📊 Calculated metrics:');
    console.log('  - Invoices:', metrics.invoices);
    console.log('  - Sales:', metrics.sales);
    console.log('  - GP Sales:', metrics.gpSales);
    console.log('  - GP %:', metrics.gpPercent.toFixed(1));
    
    console.log('\n🛠️  Service counts:');
    Object.entries(metrics.services).forEach(([service, count]) => {
      if (count > 0) {
        console.log(`  - ${service}: ${count}`);
      }
    });
    
    // Apply field mapping like the API does
    const mappedServices = {};
    Object.entries(metrics.services).forEach(([field, count]) => {
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
      
      const serviceName = fieldMapping[field] || field;
      if (count > 0) {
        mappedServices[serviceName] = count;
      }
    });
    
    console.log('\n📋 Mapped services (what frontend should see):');
    Object.entries(mappedServices).forEach(([service, count]) => {
      console.log(`  - ${service}: ${count}`);
    });
    
    if (Object.keys(mappedServices).length > 0) {
      console.log('\n✅ This user should have visible scorecards with actual data!');
    } else {
      console.log('\n❌ No services with positive counts - scorecard would be empty');
    }
    
  } catch (error) {
    console.error('❌ Error testing scorecard endpoint:', error);
  } finally {
    await pool.end();
  }
}

testScorecardEndpoint();