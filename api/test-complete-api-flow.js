// Test the complete API flow to see where it's failing
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function testCompleteApiFlow() {
  console.log('🔍 Testing complete API flow to diagnose user issue...\n');
  
  try {
    // Test 1: Check if new endpoint exists and returns data
    console.log('1️⃣ Testing /api/users/with-performance-data endpoint...');
    
    const usersQuery = `
      SELECT DISTINCT
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.role, u.status
      FROM users u
      INNER JOIN performance_data pd ON pd.advisor_user_id = u.id
      WHERE u.status = 'active' AND pd.data_type = 'services'
      ORDER BY u.first_name, u.last_name
      LIMIT 5
    `;
    
    const usersResult = await pool.query(usersQuery);
    console.log(`✅ New endpoint should return ${usersResult.rows.length} users (showing first 5):`);
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (${user.role}) - ID: ${user.id}`);
    });
    
    // Test 2: Check scorecard API for a known user
    console.log('\n2️⃣ Testing scorecard API for user 243 (John Blackerby)...');
    
    const userId = 243;
    const startDate = '2024-01-01';
    const endDate = '2025-07-31';
    
    // Get performance data
    const performanceResult = await pool.query(`
      SELECT pd.data FROM performance_data pd
      WHERE pd.advisor_user_id = $1 AND pd.data_type = 'services'
      AND pd.upload_date BETWEEN $2 AND $3
    `, [userId, startDate, endDate]);
    
    if (performanceResult.rows.length === 0) {
      console.log('❌ No performance data found for user 243');
      return;
    }
    
    console.log(`✅ Found ${performanceResult.rows.length} performance records`);
    
    // Simulate the fixed scorecard API logic
    const aggregatedData = {};
    const aggregatedOtherServices = {};
    let totalSales = 0, totalInvoices = 0, totalGpSales = 0;
    
    performanceResult.rows.forEach(row => {
      const data = row.data;
      totalInvoices += parseInt(data.invoices || 0);
      totalSales += parseFloat(data.sales || 0);
      totalGpSales += parseFloat(data.gpSales || 0);
      
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
          aggregatedData[key] = (aggregatedData[key] || 0) + data[key];
        }
      });
      
      if (data.otherServices) {
        Object.keys(data.otherServices).forEach(key => {
          const value = parseFloat(data.otherServices[key]);
          if (!isNaN(value)) {
            aggregatedOtherServices[key] = (aggregatedOtherServices[key] || 0) + value;
          }
        });
      }
    });
    
    console.log(`💰 Core metrics that should display:`);
    console.log(`  - Sales: $${totalSales.toLocaleString()}`);
    console.log(`  - Invoices: ${totalInvoices}`);
    console.log(`  - GP Sales: $${totalGpSales.toLocaleString()}`);
    console.log(`  - GP %: ${totalSales > 0 ? ((totalGpSales / totalSales) * 100).toFixed(1) : 0}%`);
    
    // Test template field mappings
    const testMappings = [
      { template: 'alltires', field: 'allTires', type: 'direct', label: 'All Tires' },
      { template: 'tirebalance', field: 'Tire Balance', type: 'nested', label: 'Tire Balance' },
      { template: 'alignments', field: 'alignments', type: 'direct', label: 'Alignments' },
      { template: 'premiumoilchange', field: 'premiumOilChange', type: 'direct', label: 'Premium Oil Change' }
    ];
    
    console.log('\n🛠️  Service data that should display:');
    let serviceCount = 0;
    testMappings.forEach(mapping => {
      let value = 0;
      if (mapping.type === 'direct') {
        value = aggregatedData[mapping.field] || 0;
      } else if (mapping.type === 'nested') {
        value = aggregatedOtherServices[mapping.field] || 0;
      }
      
      if (value > 0) {
        console.log(`  ✅ ${mapping.label}: ${value}`);
        serviceCount++;
      } else {
        console.log(`  ⚪ ${mapping.label}: 0`);
      }
    });
    
    console.log(`\n📊 Summary of what user should see:`);
    console.log(`  - Employee: John Blackerby`);
    console.log(`  - Sales data: Yes (${totalSales > 0 ? '✅' : '❌'})`);
    console.log(`  - Service counts: ${serviceCount} services with positive values`);
    
    // Test 3: Check if frontend Docker container has latest changes
    console.log('\n3️⃣ Checking frontend deployment status...');
    console.log('⚠️  The frontend is running in Docker container');
    console.log('⚠️  Docker containers do NOT automatically pick up code changes');
    console.log('⚠️  The container needs to be rebuilt to see changes');
    
    // Test 4: Check common failure points
    console.log('\n4️⃣ Checking common failure points...');
    
    // Check if user 243 is properly mapped
    const mappingCheck = await pool.query('SELECT * FROM advisor_mappings WHERE user_id = $1', [userId]);
    console.log(`  - User mapping: ${mappingCheck.rows.length > 0 ? '✅ Exists' : '❌ Missing'}`);
    
    // Check if scorecard templates exist
    const templateCheck = await pool.query('SELECT id, template_name FROM scorecard_templates WHERE market_id = 694 OR is_default = true');
    console.log(`  - Scorecard templates: ${templateCheck.rows.length > 0 ? '✅ Exist' : '❌ Missing'}`);
    
    if (templateCheck.rows.length > 0) {
      templateCheck.rows.forEach(template => {
        console.log(`    - ${template.template_name}`);
      });
    }
    
    console.log('\n5️⃣ Most likely issues:');
    console.log('  1. 🐳 Frontend Docker container not rebuilt (MOST LIKELY)');
    console.log('  2. 🌐 Browser cache not cleared');
    console.log('  3. 🔒 Authentication token expired');
    console.log('  4. 📍 Looking at wrong URL (should be localhost:3007 for Docker)');
    
    console.log('\n💡 Recommended fixes:');
    console.log('  1. Rebuild frontend container: docker-compose build --no-cache maintenance-club-frontend');
    console.log('  2. Clear browser cache and refresh');
    console.log('  3. Check browser console for JavaScript errors');
    console.log('  4. Verify you\'re on localhost:3007 (Docker) not localhost:3000');
    
  } catch (error) {
    console.error('❌ Error in complete API flow test:', error);
  } finally {
    await pool.end();
  }
}

testCompleteApiFlow();