// Script to manually process stuck upload session
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
    if (!rawData || !rawData.services_data) {
      console.log('❌ No services data found in session');
      return;
    }
    
    const servicesData = rawData.services_data;
    console.log('  - Service Records:', servicesData.length);
    
    // Process each advisor record
    let processedCount = 0;
    
    for (const employee of servicesData) {
      const employeeName = employee['Employee'];
      if (!employeeName) continue;
      
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
      const storeName = employee['Store'];
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
      console.log(`✅ Processed: ${employeeName} -> User ID ${advisorUserId}`);
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