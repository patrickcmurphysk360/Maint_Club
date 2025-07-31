// Script to manually process stuck upload session - v2
const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  host: 'localhost', 
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function processUploadSession() {
  try {
    console.log('🔄 Processing upload session 26...\n');
    
    // Get the session data
    const session = await pool.query('SELECT * FROM upload_sessions WHERE id = 26');
    if (session.rows.length === 0) {
      console.log('❌ Session 26 not found');
      return;
    }
    
    const sessionData = session.rows[0];
    console.log('📋 Session details:');
    console.log('  - Filename:', sessionData.filename);
    console.log('  - Status:', sessionData.status);
    console.log('  - Report Date:', sessionData.report_date);
    console.log('  - Advisors Found:', sessionData.discovered_advisors.length);
    
    // Get the raw data
    const rawData = sessionData.raw_data;
    console.log('  - Raw data keys:', Object.keys(rawData));
    
    // Look for employee/advisor data in different structures
    let employeeData = [];
    
    if (rawData.employees) {
      employeeData = rawData.employees;
      console.log('  - Found employees data:', employeeData.length);
    } else if (rawData.advisors) {
      employeeData = rawData.advisors;
      console.log('  - Found advisors data:', employeeData.length);
    } else if (rawData.services_data) {
      employeeData = rawData.services_data;
      console.log('  - Found services_data:', employeeData.length);
    } else {
      // Look through all keys for arrays that might contain employee data
      for (const [key, value] of Object.entries(rawData)) {
        if (Array.isArray(value) && value.length > 0 && value[0].Employee) {
          employeeData = value;
          console.log(`  - Found employee data in ${key}:`, employeeData.length);
          break;
        }
      }
    }
    
    if (employeeData.length === 0) {
      console.log('❌ No employee/advisor data found in any format');
      console.log('Available data keys:', Object.keys(rawData));
      return;
    }
    
    // Process each advisor record
    let processedCount = 0;
    
    for (const employee of employeeData) {
      const employeeName = employee['Employee'] || employee.name || employee.employeeName;
      if (!employeeName) {
        console.log('⚠️  Skipping record without employee name:', Object.keys(employee));
        continue;
      }
      
      // Find existing advisor mapping
      const mappingResult = await pool.query(
        'SELECT user_id FROM advisor_mappings WHERE spreadsheet_name = $1 AND is_active = true',
        [employeeName]
      );
      
      if (mappingResult.rows.length === 0) {
        console.log(`⚠️  No mapping found for: ${employeeName}`);
        continue;
      }
      
      const advisorUserId = mappingResult.rows[0].user_id;
      
      // Get market and store IDs
      const marketResult = await pool.query(
        'SELECT id FROM markets WHERE name ILIKE $1',
        ['%Tire South%']
      );
      
      if (marketResult.rows.length === 0) {
        console.log('❌ Market "Tire South" not found');
        continue;
      }
      
      const marketId = marketResult.rows[0].id;
      
      // Find store by name
      const storeName = employee['Store'] || employee.store || employee.storeName;
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE name ILIKE $1 AND market_id = $2',
        [`%${storeName}%`, marketId]
      );
      
      if (storeResult.rows.length === 0) {
        console.log(`⚠️  Store "${storeName}" not found for ${employeeName}`);
        continue;
      }
      
      const storeId = storeResult.rows[0].id;
      
      // Insert performance data
      await pool.query(`
        INSERT INTO performance_data (upload_date, data_type, market_id, store_id, advisor_user_id, data)
        VALUES ($1, 'services', $2, $3, $4, $5)
        ON CONFLICT (upload_date, data_type, advisor_user_id) 
        DO UPDATE SET 
          data = EXCLUDED.data,
          market_id = EXCLUDED.market_id,
          store_id = EXCLUDED.store_id
      `, [
        sessionData.report_date,
        marketId,
        storeId,
        advisorUserId,
        JSON.stringify(employee)
      ]);
      
      processedCount++;
      console.log(`✅ Processed: ${employeeName} -> User ID ${advisorUserId} (Store: ${storeName})`);
    }
    
    // Update session status
    await pool.query(
      'UPDATE upload_sessions SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['processed', 26]
    );
    
    console.log(`\n🎉 Successfully processed ${processedCount} advisor records!`);
    console.log('✅ Upload session marked as processed');
    console.log('\n🔍 Now check the advisor scorecards to see the updated data.');
    
  } catch (error) {
    console.error('❌ Error processing upload:', error);
  } finally {
    await pool.end();
  }
}

processUploadSession();