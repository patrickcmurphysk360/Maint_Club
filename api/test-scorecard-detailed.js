const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testDetailedScorecardData() {
  console.log('🧪 Detailed Scorecard Data Analysis for Akeen Jackson - August 2025\n');
  
  try {
    // Get Akeen's ID first
    const userResult = await pool.query(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%akeen%jackson%'
    `);
    const akeenId = userResult.rows[0]?.id;
    
    if (!akeenId) {
      console.log('❌ Akeen Jackson not found');
      return;
    }
    
    console.log(`Found Akeen Jackson (ID: ${akeenId})\n`);
    
    // 1. Check advisor_scorecards table
    console.log('1. Checking advisor_scorecards table...');
    try {
      const scorecardResult = await pool.query(`
        SELECT 
          asc.id,
          asc.advisor_user_id,
          asc.scorecard_data,
          asc.upload_date,
          asc.created_at,
          s.name as store_name,
          st.name as template_name
        FROM advisor_scorecards asc
        LEFT JOIN stores s ON asc.store_id = s.id
        LEFT JOIN scorecard_templates st ON asc.template_id = st.id
        WHERE asc.advisor_user_id = $1
          AND EXTRACT(YEAR FROM asc.upload_date) = 2025
          AND EXTRACT(MONTH FROM asc.upload_date) = 8
        ORDER BY asc.upload_date DESC
      `, [akeenId]);
      
      console.log(`Found ${scorecardResult.rows.length} advisor scorecard records:`);
      scorecardResult.rows.forEach((record, index) => {
        const date = new Date(record.upload_date).toLocaleDateString();
        console.log(`  ${index + 1}. ${date} - ${record.store_name} (Template: ${record.template_name})`);
        if (record.scorecard_data) {
          console.log(`     Data keys: ${Object.keys(record.scorecard_data).join(', ')}`);
          // Show key metrics
          const data = record.scorecard_data;
          if (data.sales) console.log(`     Sales: $${data.sales.toLocaleString()}`);
          if (data.alignments) console.log(`     Alignments: ${data.alignments}`);
          if (data.gpPercent) console.log(`     GP%: ${data.gpPercent}%`);
        }
      });
    } catch (error) {
      console.log(`⚠️ advisor_scorecards error: ${error.message}`);
    }
    console.log('');
    
    // 2. Get detailed performance_data structure
    console.log('2. Detailed performance_data analysis...');
    const performanceResult = await pool.query(`
      SELECT 
        pd.id,
        pd.upload_date,
        pd.data,
        pd.store_id,
        s.name as store_name,
        pd.data_type,
        pd.spreadsheet_name
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id = s.id
      WHERE pd.advisor_user_id = $1
        AND EXTRACT(YEAR FROM pd.upload_date) = 2025
        AND EXTRACT(MONTH FROM pd.upload_date) = 8
      ORDER BY pd.upload_date DESC
      LIMIT 1
    `, [akeenId]);
    
    if (performanceResult.rows.length > 0) {
      const latestRecord = performanceResult.rows[0];
      console.log(`Latest record: ${new Date(latestRecord.upload_date).toLocaleDateString()}`);
      console.log(`Store: ${latestRecord.store_name}`);
      console.log(`Data type: ${latestRecord.data_type}`);
      console.log(`Spreadsheet: ${latestRecord.spreadsheet_name || 'N/A'}`);
      
      if (latestRecord.data) {
        console.log('\nDetailed performance data structure:');
        const data = latestRecord.data;
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === 'number') {
            console.log(`  ${key}: ${value.toLocaleString()}`);
          } else {
            console.log(`  ${key}: ${value}`);
          }
        });
      }
    }
    console.log('');
    
    // 3. Check scorecard templates to understand expected structure
    console.log('3. Checking scorecard templates...');
    const templatesResult = await pool.query(`
      SELECT 
        st.id,
        st.name,
        st.description,
        st.market_id,
        m.name as market_name
      FROM scorecard_templates st
      LEFT JOIN markets m ON st.market_id = m.id
      ORDER BY st.name
    `);
    
    console.log(`Found ${templatesResult.rows.length} scorecard templates:`);
    templatesResult.rows.forEach(template => {
      console.log(`  - ${template.name} (Market: ${template.market_name || 'Global'})`);
    });
    
    // Get fields for the first template
    if (templatesResult.rows.length > 0) {
      const firstTemplate = templatesResult.rows[0];
      console.log(`\nFields in "${firstTemplate.name}" template:`);
      
      const fieldsResult = await pool.query(`
        SELECT 
          stf.field_name,
          stf.field_type,
          stf.display_name,
          stf.category_id,
          stc.name as category_name
        FROM scorecard_template_fields stf
        LEFT JOIN scorecard_template_categories stc ON stf.category_id = stc.id
        WHERE stf.template_id = $1
        ORDER BY stc.name, stf.display_name
      `, [firstTemplate.id]);
      
      const categories = {};
      fieldsResult.rows.forEach(field => {
        const category = field.category_name || 'Uncategorized';
        if (!categories[category]) categories[category] = [];
        categories[category].push(`${field.display_name} (${field.field_name})`);
      });
      
      Object.entries(categories).forEach(([category, fields]) => {
        console.log(`    ${category}:`);
        fields.forEach(field => console.log(`      - ${field}`));
      });
    }
    console.log('');
    
    // 4. Test if performance_data is the main scorecard data source
    console.log('4. Summary of data sources:');
    console.log(`✅ performance_data: ${performanceResult.rows.length} records (main data source)`);
    
    const advisorScorecardCount = await pool.query(`
      SELECT COUNT(*) as count FROM advisor_scorecards WHERE advisor_user_id = $1
    `, [akeenId]).catch(() => ({ rows: [{ count: 0 }] }));
    console.log(`📊 advisor_scorecards: ${advisorScorecardCount.rows[0].count} records`);
    
  } catch (error) {
    console.error('❌ Error in detailed scorecard analysis:', error);
  } finally {
    await pool.end();
  }
}

testDetailedScorecardData();