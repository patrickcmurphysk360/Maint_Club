const { Pool } = require('pg');

async function checkAtlantaData() {
  const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'maintenance_club_mvp',
    password: 'ducks2020',
    port: 5432,
  });

  console.log('🧪 Checking Atlanta alignment data for August 2025...\n');

  try {
    // Find Atlanta store
    const storeResult = await pool.query(
      'SELECT id, name FROM stores WHERE name ILIKE \'%atlanta%\' LIMIT 1'
    );
    
    if (storeResult.rows.length === 0) {
      console.log('❌ Atlanta store not found');
      return;
    }
    
    const atlanta = storeResult.rows[0];
    console.log(`🏪 Found Atlanta store: ${atlanta.name} (ID: ${atlanta.id})`);

    // Get all August 2025 uploads for Atlanta
    const uploadsResult = await pool.query(`
      SELECT 
        upload_date,
        advisor_user_id,
        data->>'alignments' as alignments,
        data->>'advisor_name' as advisor_name,
        id
      FROM performance_data
      WHERE store_id = $1
      AND data_type = 'services'
      AND EXTRACT(YEAR FROM upload_date) = 2025
      AND EXTRACT(MONTH FROM upload_date) = 8
      ORDER BY upload_date DESC, id DESC
    `, [atlanta.id]);

    console.log(`\nFound ${uploadsResult.rows.length} August 2025 uploads for Atlanta:`);
    
    const uploadsByDate = {};
    uploadsResult.rows.forEach(row => {
      const date = row.upload_date.toISOString().split('T')[0];
      if (!uploadsByDate[date]) uploadsByDate[date] = [];
      uploadsByDate[date].push(row);
    });

    Object.keys(uploadsByDate).sort().reverse().forEach(date => {
      console.log(`\n📅 Upload Date: ${date}`);
      const dayUploads = uploadsByDate[date];
      let totalAlignments = 0;
      dayUploads.forEach(row => {
        const alignments = parseInt(row.alignments) || 0;
        totalAlignments += alignments;
        console.log(`   👤 ${row.advisor_name || 'Unknown'}: ${alignments} alignments`);
      });
      console.log(`   📊 Total for ${date}: ${totalAlignments} alignments`);
    });

    // Get the LATEST upload date data only
    const latestDate = Object.keys(uploadsByDate).sort().reverse()[0];
    if (latestDate) {
      const latestData = uploadsByDate[latestDate];
      const latestTotal = latestData.reduce((sum, row) => sum + (parseInt(row.alignments) || 0), 0);
      console.log(`\n✅ LATEST MTD (most recent upload ${latestDate}): ${latestTotal} alignments`);
      console.log(`   This should match user expectation of 12 alignments`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAtlantaData();