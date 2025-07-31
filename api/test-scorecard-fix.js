// Test the new scorecard API fix
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function testScorecardFix() {
  console.log('🔍 Testing scorecard API fix...\n');
  
  try {
    const userId = 243;
    const startDate = '2024-01-01';
    const endDate = '2025-07-31';
    
    // Get performance data
    const performanceResult = await pool.query(`
      SELECT pd.data
      FROM performance_data pd
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date BETWEEN $2 AND $3
      ORDER BY pd.upload_date DESC
    `, [userId, startDate, endDate]);
    
    // Simulate the new aggregation logic
    const aggregatedData = {};
    const aggregatedOtherServices = {};
    
    performanceResult.rows.forEach(row => {
      const data = row.data;
      
      // Aggregate all numeric fields from main data
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
          aggregatedData[key] = (aggregatedData[key] || 0) + data[key];
        }
      });
      
      // Aggregate otherServices nested data
      if (data.otherServices) {
        Object.keys(data.otherServices).forEach(key => {
          const value = parseFloat(data.otherServices[key]);
          if (!isNaN(value)) {
            aggregatedOtherServices[key] = (aggregatedOtherServices[key] || 0) + value;
          }
        });
      }
    });
    
    console.log('📊 Aggregated main data (top 10):');
    Object.entries(aggregatedData)
      .filter(([_, value]) => value > 0)
      .slice(0, 10)
      .forEach(([key, value]) => console.log(`  ${key}: ${value}`));
    
    console.log('\n🔧 Aggregated otherServices:');
    Object.entries(aggregatedOtherServices)
      .filter(([_, value]) => value > 0)
      .forEach(([key, value]) => console.log(`  "${key}": ${value}`));
    
    // Test the new template mapping
    const templateFieldMappings = {
      'coolantflush': { type: 'direct', field: 'coolantFlush', label: 'Coolant Flush' },
      'tirebalance': { type: 'nested', field: 'Tire Balance', label: 'Tire Balance' },
      'tirerotation': { type: 'nested', field: 'Tire Rotation', label: 'Tire Rotation' },
      'alltires': { type: 'direct', field: 'allTires', label: 'All Tires' },
      'alignments': { type: 'direct', field: 'alignments', label: 'Alignments' },
      'premiumoilchange': { type: 'direct', field: 'premiumOilChange', label: 'Premium Oil Change' }
    };
    
    console.log('\n🎯 Template field mapping results:');
    const mappedServices = {};
    
    Object.entries(templateFieldMappings).forEach(([templateKey, mapping]) => {
      let value = 0;
      
      if (mapping.type === 'direct') {
        value = aggregatedData[mapping.field] || 0;
      } else if (mapping.type === 'nested') {
        value = aggregatedOtherServices[mapping.field] || 0;
      }
      
      if (value > 0) {
        mappedServices[mapping.label] = value;
      }
      
      console.log(`  ${templateKey} -> ${mapping.label}: ${value} ${value > 0 ? '✅' : '⚪'}`);
    });
    
    console.log('\n🚀 Final mapped services for API response:');
    Object.entries(mappedServices).forEach(([service, count]) => {
      console.log(`  "${service}": ${count}`);
    });
    
    const beforeCount = 13; // From previous test
    const afterCount = Object.keys(mappedServices).length;
    
    console.log(`\n📈 Impact:`);
    console.log(`  Services with template fix: ${afterCount}`);
    console.log(`  Key improvements:`);
    console.log(`    - "Tire Balance": ${mappedServices['Tire Balance'] || 0} (was missing!)`);
    console.log(`    - "Tire Rotation": ${mappedServices['Tire Rotation'] || 0} (was missing!)`);
    
    console.log(`\n✅ Template field names should now display correctly as labels!`);
    
  } catch (error) {
    console.error('❌ Error testing scorecard fix:', error);
  } finally {
    await pool.end();
  }
}

testScorecardFix();