// Simulate scorecard API response for analysis
// This simulates what the scorecard API would return for Akeem Jackson

// Sample data structure based on the expected values you provided
const simulateAkeemScorecard = () => {
  console.log('🔍 Simulating Akeem Jackson scorecard data analysis...\n');
  
  // Expected data from your input
  const expectedData = {
    atlanta: {
      invoices: 216,
      sales: 64779,
      avgSpend: 300,
      gpSales: 27656,
      gpPercent: 42.7,
      allTires: 191
    },
    stores: ['McDonough', 'Atlanta', 'Marietta Blvd']
  };
  
  console.log('📊 EXPECTED DATA FOR ATLANTA STORE:');
  console.log(`- Invoices: ${expectedData.atlanta.invoices}`);
  console.log(`- Sales: $${expectedData.atlanta.sales.toLocaleString()}`);
  console.log(`- Avg Spend: $${expectedData.atlanta.avgSpend}`);
  console.log(`- GP Sales: $${expectedData.atlanta.gpSales.toLocaleString()}`);
  console.log(`- GP Percent: ${expectedData.atlanta.gpPercent}%`);
  console.log(`- All Tires: ${expectedData.atlanta.allTires}`);
  
  // What the scorecard API would need to show
  console.log('\n📋 SCORECARD API REQUIREMENTS:');
  console.log('1. Multi-store advisor with 3 stores');
  console.log('2. Individual store tabs showing store-specific data');
  console.log('3. Rollup tab showing combined totals');
  console.log('4. Proper service field mapping for "All Tires"');
  
  // Key data mapping points
  console.log('\n🔑 KEY DATA MAPPING POINTS TO CHECK:');
  console.log('1. advisor_mappings table:');
  console.log('   - Should have entry for "Akeem Jackson" or similar');
  console.log('   - Mapped to a user_id');
  console.log('   - Active status = true');
  
  console.log('\n2. performance_data table:');
  console.log('   - Upload date: 2025-07-31 (for July 30 data)');
  console.log('   - advisor_user_id: (Akeem\'s user ID)');
  console.log('   - store_id: (Atlanta store ID)');
  console.log('   - data JSON should contain:');
  console.log('     {');
  console.log('       "invoices": 216,');
  console.log('       "sales": 64779,');
  console.log('       "gpSales": 27656,');
  console.log('       "gpPercent": 42.7,');
  console.log('       "allTires": 191  // or in otherServices["All Tires"]');
  console.log('     }');
  
  console.log('\n3. Template field mapping:');
  console.log('   - "alltires" -> should map to data.allTires or otherServices["All Tires"]');
  console.log('   - Check templateFieldMappings in scorecard.js lines 143-205');
  
  console.log('\n📍 SPECIFIC ISSUES TO INVESTIGATE:');
  console.log('1. Is "All Tires" being stored in the correct field?');
  console.log('   - Check if it\'s in data.allTires');
  console.log('   - Or in data.otherServices["All Tires"]');
  console.log('   - Or under a different key entirely');
  
  console.log('\n2. Is the Atlanta store data being included?');
  console.log('   - Check store_id mapping');
  console.log('   - Verify store name is "Atlanta" in stores table');
  
  console.log('\n3. Is MTD aggregation working correctly?');
  console.log('   - Should query for EXTRACT(MONTH) = 7');
  console.log('   - Should include all records from July 2025');
  
  console.log('\n🛠️ DEBUGGING STEPS:');
  console.log('1. Check raw performance_data:');
  console.log('   SELECT data FROM performance_data');
  console.log('   WHERE advisor_user_id = (Akeem\'s ID)');
  console.log('   AND upload_date >= \'2025-07-31\'');
  console.log('   AND upload_date < \'2025-08-01\'');
  
  console.log('\n2. Check advisor mapping:');
  console.log('   SELECT * FROM advisor_mappings');
  console.log('   WHERE LOWER(spreadsheet_name) LIKE \'%akeem%\'');
  
  console.log('\n3. Check store mapping:');
  console.log('   SELECT * FROM stores');
  console.log('   WHERE LOWER(name) LIKE \'%atlanta%\'');
  
  // Simulate what might be wrong
  console.log('\n⚠️ COMMON ISSUES:');
  console.log('1. Name mismatch: "Akeem Jackson" vs "A. Jackson" vs "Jackson, Akeem"');
  console.log('2. Store ID mismatch: numeric vs string conversion');
  console.log('3. Service field mapping: "allTires" vs "All Tires" vs "alltires"');
  console.log('4. Date filtering: upload_date vs data representing previous day');
  console.log('5. Aggregation: summing vs replacing values');
};

// Function to show expected scorecard output
const showExpectedScorecard = () => {
  console.log('\n✅ EXPECTED SCORECARD OUTPUT:');
  
  console.log('\n📊 By-Store API Response Structure:');
  console.log(`{
  "userId": [Akeem's ID],
  "isMultiStore": true,
  "totalStores": 3,
  "marketId": 694,
  "marketName": "Tire South - Tekmetric",
  "rollupData": {
    "metrics": {
      "invoices": [sum of all 3 stores],
      "sales": [sum of all 3 stores],
      "gpSales": [sum of all 3 stores],
      "gpPercent": "[calculated %]"
    },
    "services": {
      "All Tires": [sum of all 3 stores]
    }
  },
  "storeData": [
    {
      "storeId": [Atlanta store ID],
      "storeName": "Atlanta",
      "marketId": 694,
      "metrics": {
        "invoices": 216,
        "sales": 64779,
        "gpSales": 27656,
        "gpPercent": "42.7"
      },
      "services": {
        "All Tires": 191
      }
    },
    // ... McDonough and Marietta Blvd data
  ]
}`);
  
  console.log('\n📊 Regular Scorecard API (for Atlanta only):');
  console.log('Should show aggregated data if multi-store');
  console.log('Or Atlanta-only data if filtered by store');
};

// Run simulation
simulateAkeemScorecard();
showExpectedScorecard();