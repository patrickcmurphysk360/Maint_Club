const { Pool } = require('pg');
const pool = new Pool({
  user: 'admin', host: 'localhost', database: 'maintenance_club_mvp', 
  password: 'ducks2020', port: 5432
});

async function checkTemplateFields() {
  console.log('🔍 Checking scorecard template field names...\n');
  
  try {
    // Check if scorecard templates exist
    const templatesResult = await pool.query(`
      SELECT id, template_name, market_id, is_default 
      FROM scorecard_templates 
      WHERE market_id = 694 OR is_default = true
    `);
    
    console.log('📋 Available templates:');
    templatesResult.rows.forEach(template => {
      console.log(`  - ${template.template_name} (Market: ${template.market_id || 'Default'})`);
    });
    
    if (templatesResult.rows.length === 0) {
      console.log('❌ No scorecard templates found! This explains the display issue.');
      return;
    }
    
    // Get template fields for market 694
    const fieldsResult = await pool.query(`
      SELECT 
        st.template_name,
        stc.category_name,
        stf.field_key,
        stf.field_label,
        stf.field_type,
        stf.is_enabled
      FROM scorecard_templates st
      JOIN scorecard_template_categories stc ON stc.template_id = st.id
      JOIN scorecard_template_fields stf ON stf.category_id = stc.id
      WHERE (st.market_id = 694 OR st.is_default = true)
        AND stf.field_type = 'service'
        AND stf.is_enabled = true
      ORDER BY stc.display_order, stf.display_order
    `);
    
    console.log('\n🛠️  Service template fields:');
    fieldsResult.rows.forEach(row => {
      console.log(`  ${row.field_key} -> "${row.field_label}"`);
    });
    
    // Check if these field_keys exist in our performance data
    console.log('\n🔍 Checking if template fields match data fields...');
    const dataResult = await pool.query(`
      SELECT data FROM performance_data WHERE advisor_user_id = 243 LIMIT 1
    `);
    
    const dataFields = Object.keys(dataResult.rows[0].data);
    console.log('\nData fields available:', dataFields.slice(0, 10).join(', '), '...');
    
    fieldsResult.rows.forEach(row => {
      const exists = dataFields.includes(row.field_key);
      console.log(`  ${exists ? '✅' : '❌'} ${row.field_key} (${row.field_label}) - ${exists ? 'EXISTS' : 'MISSING'} in data`);
    });
    
  } catch (error) {
    console.error('❌ Error checking template fields:', error);
  } finally {
    await pool.end();
  }
}

checkTemplateFields();