// Test vendor mappings with the template fix
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function testVendorMappings() {
  console.log('🔍 Testing vendor mappings with template fix...\n');
  
  try {
    const userId = 243; // John Blackerby
    
    // Step 1: Get vendor mappings for this user (from the scorecard API logic)
    console.log('1️⃣ Getting vendor mappings for user 243...');
    const vendorMappingsResult = await pool.query(`
      SELECT DISTINCT
        vpm.vendor_id,
        vpm.service_field,
        vpm.product_name,
        vt.name as vendor_name
      FROM advisor_mappings am
      JOIN market_tags mt ON mt.market_id = am.market_id
      JOIN vendor_product_mappings vpm ON vpm.vendor_id = mt.tag_id
      JOIN vendor_tags vt ON vt.id = vpm.vendor_id
      WHERE am.user_id = $1 AND am.is_active = true
    `, [userId]);
    
    console.log(`✅ Found ${vendorMappingsResult.rows.length} vendor mappings:`);
    vendorMappingsResult.rows.forEach(row => {
      console.log(`  ${row.service_field} -> "${row.product_name}" (${row.vendor_name})`);
    });
    
    // Build vendor mapping object like the API does
    const vendorMappings = {};
    vendorMappingsResult.rows.forEach(row => {
      if (!vendorMappings[row.service_field]) {
        vendorMappings[row.service_field] = {};
      }
      vendorMappings[row.service_field][row.vendor_id] = {
        productName: row.product_name,
        vendorName: row.vendor_name
      };
    });
    
    console.log('\n2️⃣ Vendor mapping object:');
    Object.keys(vendorMappings).forEach(service => {
      const mapping = Object.values(vendorMappings[service])[0];
      console.log(`  "${service}" -> "${mapping.productName}" (${mapping.vendorName})`);
    });
    
    // Step 2: Test with template mapping
    console.log('\n3️⃣ Testing template + vendor mapping integration...');
    
    // Get performance data and aggregate like the fixed API does
    const performanceResult = await pool.query(`
      SELECT pd.data FROM performance_data pd
      WHERE pd.advisor_user_id = $1 AND pd.data_type = 'services'
    `, [userId]);
    
    const aggregatedData = {};
    performanceResult.rows.forEach(row => {
      Object.keys(row.data).forEach(key => {
        if (typeof row.data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
          aggregatedData[key] = (aggregatedData[key] || 0) + row.data[key];
        }
      });
    });
    
    // Test specific services that should have vendor mappings
    const testServices = [
      { template: 'premiumoilchange', field: 'premiumOilChange', label: 'Premium Oil Change' },
      { template: 'engineperformanceservice', field: 'Engine Performance Service', label: 'Engine Performance Service', nested: true }
    ];
    
    console.log('\nTesting vendor mapping application:');
    testServices.forEach(service => {
      let value = service.nested ? 0 : aggregatedData[service.field] || 0; // Simplified for test
      
      if (value > 0 || service.template === 'premiumoilchange') { // Force test for premium oil
        value = value || 29; // Use known value for test
        
        let displayName = service.label;
        
        // Check if there's a vendor mapping (same logic as fixed API)
        if (vendorMappings[service.label]) {
          const vendorMapping = Object.values(vendorMappings[service.label])[0];
          if (vendorMapping) {
            displayName = vendorMapping.productName;
            console.log(`  ✅ ${service.template} -> "${service.label}" -> "${displayName}" (VENDOR MAPPED)`);
          } else {
            console.log(`  ⚪ ${service.template} -> "${service.label}" (no vendor mapping)`);
          }
        } else {
          console.log(`  ⚪ ${service.template} -> "${service.label}" (no vendor mapping available)`);
        }
      }
    });
    
    // Step 3: Check if vendor mappings are broken by the template field fix
    console.log('\n4️⃣ Checking for vendor mapping issues...');
    
    const potentialIssues = [];
    
    // Check if vendor mappings expect different service names than template labels
    Object.keys(vendorMappings).forEach(vendorServiceName => {
      const templateMapping = {
        'Premium Oil Change': 'premiumoilchange',
        'Engine Performance Service': 'engineperformanceservice'
      };
      
      const hasTemplateMapping = Object.values(templateMapping).includes(vendorServiceName.toLowerCase().replace(/\s+/g, ''));
      
      if (!hasTemplateMapping) {
        potentialIssues.push({
          vendorService: vendorServiceName,
          issue: 'Vendor mapping exists but no template field mapping'
        });
      }
    });
    
    if (potentialIssues.length > 0) {
      console.log('⚠️  Potential vendor mapping issues:');
      potentialIssues.forEach(issue => {
        console.log(`  - ${issue.vendorService}: ${issue.issue}`);
      });
    } else {
      console.log('✅ No vendor mapping issues detected');
    }
    
    // Step 4: Test the full flow with actual scorecard API query
    console.log('\n5️⃣ Testing if vendor mappings work in context...');
    
    // Simulate what should happen for premium oil change
    const premiumOilValue = aggregatedData.premiumOilChange || 0;
    if (premiumOilValue > 0) {
      let finalDisplayName = 'Premium Oil Change';
      
      if (vendorMappings['Premium Oil Change']) {
        const vendorMapping = Object.values(vendorMappings['Premium Oil Change'])[0];
        finalDisplayName = vendorMapping.productName;
      }
      
      console.log(`Final result: Premium Oil Change (${premiumOilValue}) -> "${finalDisplayName}"`);
    }
    
    console.log('\n✅ Vendor mapping test complete');
    
  } catch (error) {
    console.error('❌ Error testing vendor mappings:', error);
  } finally {
    await pool.end();
  }
}

testVendorMappings();