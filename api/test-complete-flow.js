// Test the complete flow: users -> scorecard data
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function testCompleteFlow() {
  console.log('🔍 Testing complete frontend flow...\n');
  
  try {
    // Step 1: Test the new users endpoint query
    console.log('1️⃣ Testing users with performance data query...');
    
    const usersQuery = `
      SELECT DISTINCT
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.role, u.status, u.is_vendor as "isVendor", 
        u.created_at as "createdAt", u.mobile, u.vendor,
        s.name as store_name, s.id as store_id,
        m.name as market_name, m.id as market_id
      FROM users u
      INNER JOIN performance_data pd ON pd.advisor_user_id = u.id
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
      LEFT JOIN markets m ON uma.market_id::integer = m.id
      WHERE u.status = 'active' AND pd.data_type = 'services'
      ORDER BY u.first_name, u.last_name
    `;
    
    const usersResult = await pool.query(usersQuery);
    console.log(`✅ Found ${usersResult.rows.length} users with performance data`);
    
    // Show first few users by role
    const roles = {};
    usersResult.rows.forEach(user => {
      if (!roles[user.role]) roles[user.role] = [];
      roles[user.role].push(`${user.firstName} ${user.lastName}`);
    });
    
    console.log('📊 Users by role:');
    Object.entries(roles).forEach(([role, users]) => {
      console.log(`  ${role}: ${users.length} (${users.slice(0, 2).join(', ')}${users.length > 2 ? '...' : ''})`);
    });
    
    // Step 2: Test scorecard API for one user
    console.log('\n2️⃣ Testing scorecard API for John Blackerby (ID: 243)...');
    
    const userId = 243;
    const startDate = '2024-01-01';
    const endDate = '2025-07-31';
    
    // Simulate the scorecard API logic
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
    
    if (performanceResult.rows.length === 0) {
      console.log('❌ No performance data for this user');
      return;
    }
    
    console.log(`✅ Found ${performanceResult.rows.length} performance records`);
    
    // Calculate metrics like the API does
    const metrics = { invoices: 0, sales: 0, gpSales: 0, services: {} };
    const serviceFields = [
      'premiumOilChange', 'fuelAdditive', 'engineFlush', 'filters',
      'oilChange', 'alignments', 'brakeService', 'brakeFlush',
      'engineAirFilter', 'cabinAirFilter', 'coolantFlush',
      'differentialService', 'fuelSystemService', 'powerSteeringFlush',
      'transmissionFluidService', 'battery', 'allTires'
    ];
    
    serviceFields.forEach(field => { metrics.services[field] = 0; });
    
    performanceResult.rows.forEach(row => {
      const data = row.data;
      metrics.invoices += parseInt(data.invoices || 0);
      metrics.sales += parseFloat(data.sales || 0);
      metrics.gpSales += parseFloat(data.gpSales || 0);
      
      serviceFields.forEach(field => {
        metrics.services[field] += parseInt(data[field] || 0);
      });
    });
    
    metrics.gpPercent = metrics.sales > 0 ? (metrics.gpSales / metrics.sales) * 100 : 0;
    
    console.log('💰 Core metrics:');
    console.log(`  Sales: $${metrics.sales.toLocaleString()}`);
    console.log(`  GP Sales: $${metrics.gpSales.toLocaleString()}`);
    console.log(`  GP %: ${metrics.gpPercent.toFixed(1)}%`);
    console.log(`  Invoices: ${metrics.invoices}`);
    
    // Apply field mapping like the API does
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
    
    const mappedServices = {};
    Object.entries(metrics.services).forEach(([field, count]) => {
      const serviceName = fieldMapping[field] || field;
      if (count > 0) {
        mappedServices[serviceName] = count;
      }
    });
    
    console.log('\n🛠️  Services (what frontend should receive):');
    Object.entries(mappedServices).forEach(([service, count]) => {
      console.log(`  ${service}: ${count}`);
    });
    
    // Step 3: Test what frontend expects
    console.log('\n3️⃣ Testing frontend service mapping...');
    
    const frontendExpectations = {
      'premiumOilChange': mappedServices['Premium Oil Change'],
      'standardOilChange': mappedServices['Oil Change'],
      'cabinAirFilter': mappedServices['Cabin Air Filter'],
      'engineAirFilter': mappedServices['Engine Air Filter'],
      'coolantFlush': mappedServices['Coolant Flush'],
      'brakeFluidFlush': mappedServices['Brake Flush'],
      'transmissionFluidService': mappedServices['Transmission Fluid Service'],
      'fuelAdditive': mappedServices['Fuel Additive'],
      'powerSteeringFluidService': mappedServices['Power Steering Flush'],
      'engineFlush': mappedServices['Engine Flush'],
      'alignment': mappedServices['Alignments'],
      'battery': mappedServices['Battery']
    };
    
    console.log('Frontend mapping results:');
    Object.entries(frontendExpectations).forEach(([field, value]) => {
      if (value > 0) {
        console.log(`  ✅ ${field}: ${value}`);
      } else if (value === 0) {
        console.log(`  ⚪ ${field}: 0`);
      } else {
        console.log(`  ❌ ${field}: undefined (missing mapping)`);
      }
    });
    
    const workingFields = Object.entries(frontendExpectations).filter(([_, value]) => value > 0);
    console.log(`\n🎯 Summary: ${workingFields.length} services with data should show in scorecards`);
    
    if (workingFields.length > 0) {
      console.log('✅ User should have visible scorecard data!');
    } else {
      console.log('❌ User would have empty scorecard (no positive service counts)');
    }
    
  } catch (error) {
    console.error('❌ Error in complete flow test:', error);
  } finally {
    await pool.end();
  }
}

testCompleteFlow();