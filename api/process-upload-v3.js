// Script to manually process stuck upload session - v3 (simple insert)
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
    const sessionData = session.rows[0];
    const rawData = sessionData.raw_data;
    const employeeData = rawData.employees;
    
    console.log('📋 Found', employeeData.length, 'employee records');
    
    // First, let's clean up any existing data for this date to avoid duplicates
    await pool.query(
      'DELETE FROM performance_data WHERE upload_date = $1 AND data_type = $2',
      [sessionData.report_date, 'services']
    );
    
    console.log('🗑️  Cleared existing data for', sessionData.report_date);
    
    // Process each advisor record
    let processedCount = 0;
    
    for (const employee of employeeData) {
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
      const marketResult = await pool.query('SELECT id FROM markets WHERE name ILIKE $1', ['%Tire South%']);
      const marketId = marketResult.rows[0]?.id;
      
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
      
      // Simple insert
      await pool.query(`
        INSERT INTO performance_data (upload_date, data_type, market_id, store_id, advisor_user_id, data)
        VALUES ($1, 'services', $2, $3, $4, $5)
      `, [
        sessionData.report_date,
        marketId,
        storeId,
        advisorUserId,
        JSON.stringify(employee)
      ]);
      
      processedCount++;
      console.log(`✅ ${processedCount}: ${employeeName} -> Store: ${storeName}`);
    }
    
    // Update session status
    await pool.query(
      'UPDATE upload_sessions SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['processed', 26]
    );
    
    console.log(`\n🎉 Successfully processed ${processedCount} advisor records!`);
    console.log('✅ Upload session marked as processed');
    console.log('\n🔍 Data uploaded for date: 2025-07-28');
    console.log('📊 Check advisor scorecards to see the new performance data!');
    
  } catch (error) {
    console.error('❌ Error processing upload:', error);
  } finally {
    await pool.end();
  }
}

processUploadSession();