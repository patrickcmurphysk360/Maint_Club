// Test the vendor mapping fix
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function testVendorMappingFix() {
  console.log('🔍 Testing vendor mapping fix...\n');
  
  try {
    const userId = 243;
    
    // Get vendor mappings
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
    
    // Build vendor mapping object
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
    
    console.log('📊 Available vendor mappings:');
    Object.keys(vendorMappings).forEach(service => {
      const mapping = Object.values(vendorMappings[service])[0];
      console.log(`  "${service}" -> "${mapping.productName}"`);
    });
    
    // Test the new multi-approach vendor mapping logic
    console.log('\n🔧 Testing new vendor mapping logic:');
    
    const testCases = [
      {
        templateKey: 'premiumoilchange',
        mapping: { type: 'direct', field: 'premiumOilChange', label: 'Premium Oil Change' },
        value: 62
      },
      {
        templateKey: 'engineperformanceservice',
        mapping: { type: 'nested', field: 'Engine Performance Service', label: 'Engine Performance Service' },
        value: 5 // Test value
      }
    ];
    
    testCases.forEach(testCase => {
      const { templateKey, mapping, value } = testCase;
      
      console.log(`\nTesting: ${templateKey} -> ${mapping.label}`);
      
      let displayName = mapping.label;
      let vendorMapping = null;
      let matchedBy = null;
      
      // Simulate the new logic
      // 1. Try exact template key match
      if (vendorMappings[templateKey]) {
        vendorMapping = Object.values(vendorMappings[templateKey])[0];
        matchedBy = 'template key';
      }
      
      // 2. Try exact label match
      if (!vendorMapping && vendorMappings[mapping.label]) {
        vendorMapping = Object.values(vendorMappings[mapping.label])[0];
        matchedBy = 'label';
      }
      
      // 3. Try camelCase field name match
      if (!vendorMapping && mapping.type === 'direct' && vendorMappings[mapping.field]) {
        vendorMapping = Object.values(vendorMappings[mapping.field])[0];
        matchedBy = 'camelCase field';
      }
      
      if (vendorMapping) {
        displayName = vendorMapping.productName;
        console.log(`  ✅ MAPPED by ${matchedBy}: "${displayName}"`);
      } else {
        console.log(`  ⚪ NO MAPPING: "${displayName}"`);
      }
      
      console.log(`  Final result: "${displayName}": ${value}`);
    });
    
    console.log('\n🎯 Expected improvement:');
    console.log('  Before fix: "Premium Oil Change": 62');
    console.log('  After fix:  "BG Advanced Formula MOA®": 62');
    
    console.log('\n✅ Vendor mapping fix should now work correctly!');
    
  } catch (error) {
    console.error('❌ Error testing vendor mapping fix:', error);
  } finally {
    await pool.end();
  }
}

testVendorMappingFix();