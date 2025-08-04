const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testScorecardStructure() {
  console.log('🧪 Testing Scorecard Data Structure\n');
  
  try {
    // Get Akeen's ID first
    const userResult = await pool.query(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
    `);
    const akeenId = userResult.rows[0]?.id;
    console.log(`Found Akeen Jackson (ID: ${akeenId})\n`);
    
    // 1. Check performance_data table structure
    console.log('1. performance_data table structure:');
    const perfColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'performance_data'
      ORDER BY ordinal_position
    `);
    
    perfColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    console.log('');
    
    // 2. Get performance data without spreadsheet_name
    console.log('2. Akeen\'s performance data for August 2025:');
    const performanceResult = await pool.query(`
      SELECT 
        pd.id,
        pd.upload_date,
        pd.data,
        pd.store_id,
        s.name as store_name,
        pd.data_type
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      WHERE pd.advisor_user_id = $1
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 8
      ORDER BY pd.upload_date DESC
    `, [akeenId]);
    
    console.log(`Found ${performanceResult.rows.length} records:`);
    performanceResult.rows.forEach((record, index) => {
      const date = new Date(record.upload_date).toLocaleDateString();
      console.log(`\n  ${index + 1}. ${date} - ${record.store_name} (${record.data_type})`);
      
      if (record.data) {
        console.log('     Performance metrics:');
        const data = record.data;
        Object.entries(data).sort().forEach(([key, value]) => {
          if (typeof value === 'number') {
            console.log(`       ${key}: ${value.toLocaleString()}`);
          } else {
            console.log(`       ${key}: ${value}`);
          }
        });
      }
    });
    console.log('');
    
    // 3. Check advisor_scorecards table structure (fix the alias issue)
    console.log('3. advisor_scorecards table structure:');
    try {
      const scorecardColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'advisor_scorecards'
        ORDER BY ordinal_position
      `);
      
      if (scorecardColumns.rows.length > 0) {
        scorecardColumns.rows.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
        
        // Now query the advisor_scorecards data with proper syntax
        console.log('\n4. Akeen\'s advisor_scorecards data:');
        const scorecardResult = await pool.query(`
          SELECT 
            id,
            advisor_user_id,
            scorecard_data,
            upload_date,
            created_at,
            store_id,
            template_id
          FROM advisor_scorecards
          WHERE advisor_user_id = $1
            AND EXTRACT(YEAR FROM upload_date) = 2025
            AND EXTRACT(MONTH FROM upload_date) = 8
          ORDER BY upload_date DESC
        `, [akeenId]);
        
        console.log(`Found ${scorecardResult.rows.length} scorecard records:`);
        scorecardResult.rows.forEach((record, index) => {
          const date = new Date(record.upload_date).toLocaleDateString();
          console.log(`  ${index + 1}. ${date} - Store ID: ${record.store_id}, Template ID: ${record.template_id}`);
          
          if (record.scorecard_data) {
            console.log('     Scorecard data keys:', Object.keys(record.scorecard_data).join(', '));
            // Show some key metrics
            const data = record.scorecard_data;
            if (data.sales) console.log(`     Sales: $${data.sales.toLocaleString()}`);
            if (data.alignments) console.log(`     Alignments: ${data.alignments}`);
          }
        });
      } else {
        console.log('  Table does not exist or no columns found');
      }
    } catch (error) {
      console.log(`  ⚠️ advisor_scorecards table error: ${error.message}`);
    }
    console.log('');
    
    // 4. Show summary of available scorecard data
    console.log('5. Summary - Available scorecard data for Akeen Jackson August 2025:');
    if (performanceResult.rows.length > 0) {
      const latestData = performanceResult.rows[0].data;
      console.log('✅ Latest performance data available:');
      console.log(`   Date: ${new Date(performanceResult.rows[0].upload_date).toLocaleDateString()}`);
      console.log(`   Store: ${performanceResult.rows[0].store_name}`);
      console.log('   Key metrics:');
      
      // Show the most important metrics
      const importantMetrics = ['sales', 'gpSales', 'gpPercent', 'invoices', 'alignments', 'oilChange', 'retailTires'];
      importantMetrics.forEach(metric => {
        if (latestData[metric] !== undefined) {
          const value = typeof latestData[metric] === 'number' && metric.includes('Sales') 
            ? `$${latestData[metric].toLocaleString()}`
            : latestData[metric];
          console.log(`     ${metric}: ${value}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing scorecard structure:', error);
  } finally {
    await pool.end();
  }
}

testScorecardStructure();