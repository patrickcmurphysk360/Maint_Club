// Final script to process upload session with correct field names
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
    console.log('🔄 Processing upload session 26 (FINAL)...\n');
    
    // Get the session data
    const session = await pool.query('SELECT * FROM upload_sessions WHERE id = 26');
    const sessionData = session.rows[0];
    const rawData = sessionData.raw_data;
    const employeeData = rawData.employees;
    
    console.log('📋 Found', employeeData.length, 'employee records');
    
    // First, clean up any existing data for this date
    await pool.query(
      'DELETE FROM performance_data WHERE upload_date = $1 AND data_type = $2',
      [sessionData.report_date, 'services']
    );
    
    console.log('🗑️  Cleared existing data for', sessionData.report_date.toISOString().split('T')[0]);
    
    // Process each advisor record
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const employee of employeeData) {
      const employeeName = employee.employeeName;  // Correct field name!
      if (!employeeName) {
        skippedCount++;
        continue;
      }
      
      // Find existing advisor mapping
      const mappingResult = await pool.query(
        'SELECT user_id FROM advisor_mappings WHERE spreadsheet_name = $1 AND is_active = true',
        [employeeName]
      );
      
      if (mappingResult.rows.length === 0) {
        console.log(`⚠️  No mapping found for: ${employeeName}`);
        skippedCount++;
        continue;
      }
      
      const advisorUserId = mappingResult.rows[0].user_id;
      
      // Get market ID (we know it's 694 from the data)
      const marketResult = await pool.query('SELECT id FROM markets WHERE id = 694');
      const marketId = marketResult.rows[0]?.id;
      
      if (!marketId) {
        console.log('❌ Market 694 not found');
        continue;
      }
      
      // Find store by name
      const storeName = employee.storeName;
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE name ILIKE $1 AND market_id = $2',
        [`%${storeName}%`, marketId]
      );
      
      if (storeResult.rows.length === 0) {
        console.log(`⚠️  Store "${storeName}" not found for ${employeeName}`);
        skippedCount++;
        continue;
      }
      
      const storeId = storeResult.rows[0].id;
      
      // Insert performance data
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
      console.log(`✅ ${processedCount}: ${employeeName} -> Store: ${storeName} (User ID: ${advisorUserId})`);
    }
    
    // Update session status
    await pool.query(
      'UPDATE upload_sessions SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['processed', 26]
    );
    
    console.log(`\n🎉 Successfully processed ${processedCount} advisor records!`);
    console.log(`⚠️  Skipped ${skippedCount} records (no mapping or missing data)`);
    console.log('✅ Upload session marked as processed');
    console.log('\n🔍 Data uploaded for date: 2025-07-28');
    console.log('📊 Now check the advisor scorecards - you should see updated data!');
    
    // Show summary of what was uploaded
    console.log('\n📈 Performance data summary:');
    const summary = await pool.query(`
      SELECT COUNT(*) as total_records, 
             COUNT(DISTINCT advisor_user_id) as unique_advisors,
             MIN(upload_date) as earliest_date,
             MAX(upload_date) as latest_date
      FROM performance_data 
      WHERE data_type = 'services'
    `);
    
    console.log('  - Total performance records:', summary.rows[0].total_records);
    console.log('  - Unique advisors with data:', summary.rows[0].unique_advisors);
    console.log('  - Date range:', summary.rows[0].earliest_date, 'to', summary.rows[0].latest_date);
    
  } catch (error) {
    console.error('❌ Error processing upload:', error);
  } finally {
    await pool.end();
  }
}

processUploadSession();