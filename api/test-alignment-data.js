const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function checkAlignmentData() {
  const aiDataService = new AIDataService(pool);
  
  console.log('🔍 Checking alignment sales data...\n');
  
  // Check what performance data fields are available
  console.log('1. Checking performance data structure...');
  const sampleData = await pool.query(`
    SELECT data 
    FROM performance_data 
    WHERE data IS NOT NULL 
    LIMIT 3
  `);
  
  console.log('Sample performance data fields:');
  sampleData.rows.forEach((row, index) => {
    const data = row.data;
    const allFields = Object.keys(data);
    const alignmentFields = allFields.filter(k => k.toLowerCase().includes('align'));
    console.log(`Record ${index + 1}:`, alignmentFields.length > 0 ? alignmentFields : 'No alignment fields found');
    if (alignmentFields.length === 0) {
      console.log('  Available fields:', allFields.slice(0, 10).join(', '));
    }
  });
  console.log('');
  
  // Test the getTopPerformers method with alignment metric
  console.log('2. Testing getTopPerformers for alignments...');
  try {
    const topPerformers = await aiDataService.getTopPerformers('alignments', 'Tire South - Tekmetric', 8, 2025, 5);
    console.log(`Found ${topPerformers.length} alignment performers:`);
    topPerformers.forEach((performer, index) => {
      console.log(`${index + 1}. ${performer.advisor_name} (${performer.store}): ${performer.metric_value} alignments - $${performer.total_sales?.toLocaleString() || 'N/A'}`);
    });
  } catch (error) {
    console.log('❌ Error getting alignment performers:', error.message);
  }
  console.log('');
  
  // Check if alignment data exists in any form
  console.log('3. Searching for alignment-related data...');
  const alignmentSearch = await pool.query(`
    SELECT 
      advisor_user_id,
      data,
      upload_date
    FROM performance_data 
    WHERE data::text ILIKE '%align%' 
    LIMIT 5
  `);
  
  console.log(`Found ${alignmentSearch.rows.length} records with alignment data:`);
  alignmentSearch.rows.forEach((row, index) => {
    const alignmentValue = row.data.alignments || row.data.alignment || 'Not found';
    console.log(`${index + 1}. User ${row.advisor_user_id}: ${alignmentValue} (${new Date(row.upload_date).toLocaleDateString()})`);
  });
  
  await pool.end();
}

checkAlignmentData();