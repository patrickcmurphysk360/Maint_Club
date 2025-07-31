const { Pool } = require('pg');
const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function checkDataMapping() {
  console.log('🔍 Checking data field mapping issues...\n');
  
  try {
    // Get sample data
    const result = await pool.query('SELECT data FROM performance_data WHERE advisor_user_id = 243 LIMIT 1');
    const data = result.rows[0].data;
    
    console.log('📊 Main data fields:');
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'number' && key !== 'sales' && key !== 'invoices') {
        console.log(`  ${key}: ${data[key]}`);
      }
    });
    
    console.log('\n🔧 otherServices nested fields:');
    if (data.otherServices) {
      Object.keys(data.otherServices).forEach(key => {
        console.log(`  "${key}": ${data.otherServices[key]}`);
      });
    }
    
    console.log('\n🎯 Template vs Data mapping issues:');
    
    const templateMappings = [
      { template: 'coolantflush', data: 'coolantFlush' },
      { template: 'powersteeringflush', data: 'powerSteeringFlush' },
      { template: 'transmissionfluidservice', data: 'transmissionFluidService' },
      { template: 'differentialservice', data: 'differentialService' },
      { template: 'alltires', data: 'allTires' },
      { template: 'retailtires', data: 'retailTires' },
      { template: 'tireprotection', data: 'tireProtection' },
      { template: 'engineairfilter', data: 'engineAirFilter' },
      { template: 'cabinairfilter', data: 'cabinAirFilter' },
      { template: 'fuelsystemservice', data: 'fuelSystemService' },
      { template: 'fueladditive', data: 'fuelAdditive' },
      { template: 'acservice', data: 'acService' },
      { template: 'wiperblades', data: 'wiperBlades' }
    ];
    
    templateMappings.forEach(mapping => {
      const exists = data.hasOwnProperty(mapping.data);
      const value = data[mapping.data] || 0;
      console.log(`  ${mapping.template} -> ${mapping.data}: ${exists ? '✅' : '❌'} (${value})`);
    });
    
    console.log('\n🔧 otherServices mapping needed:');
    const otherServicesMappings = [
      { template: 'tirebalance', nested: 'Tire Balance' },
      { template: 'tirerotation', nested: 'Tire Rotation' },
      { template: 'batteryservice', nested: 'Battery Service' },
      { template: 'engineperformanceservice', nested: 'Engine Performance Service' },
      { template: 'sparkplugreplacement', nested: 'Spark Plug Replacement' },
      { template: 'completevehicleinspection', nested: 'Complete Vehicle Inspection' },
      { template: 'beltsreplacement', nested: 'Belts Replacement' },
      { template: 'hosereplacement', nested: 'Hose Replacement' },
      { template: 'climatecontrolservice', nested: 'Climate Control Service' }
    ];
    
    otherServicesMappings.forEach(mapping => {
      const value = data.otherServices?.[mapping.nested] || 0;
      console.log(`  ${mapping.template} -> otherServices["${mapping.nested}"]: ${value}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking data mapping:', error);
  } finally {
    await pool.end();
  }
}

checkDataMapping();