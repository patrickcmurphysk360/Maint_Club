const { Pool } = require('pg');

async function checkAtlantaDetailed() {
  const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'maintenance_club_mvp',
    password: 'ducks2020',
    port: 5432,
  });

  console.log('🧪 Detailed Atlanta alignment analysis for August 2025...\n');

  try {
    // Find Atlanta store
    const storeResult = await pool.query(
      'SELECT id, name FROM stores WHERE name ILIKE \'%atlanta%\' LIMIT 1'
    );
    
    const atlanta = storeResult.rows[0];
    console.log(`🏪 Atlanta store: ${atlanta.name} (ID: ${atlanta.id})`);

    // Get the latest August 2025 upload for Atlanta with full details
    const latestResult = await pool.query(`
      WITH latest_upload AS (
        SELECT upload_date
        FROM performance_data
        WHERE store_id = $1
        AND data_type = 'services'
        AND EXTRACT(YEAR FROM upload_date) = 2025
        AND EXTRACT(MONTH FROM upload_date) = 8
        ORDER BY upload_date DESC, id DESC
        LIMIT 1
      )
      SELECT 
        pd.upload_date,
        pd.advisor_user_id,
        pd.data->>'alignments' as alignments,
        pd.data->>'advisor_name' as advisor_name,
        pd.data->>'sales' as sales,
        pd.id,
        pd.created_at
      FROM performance_data pd, latest_upload lu
      WHERE pd.store_id = $1
      AND pd.data_type = 'services'
      AND pd.upload_date = lu.upload_date
      ORDER BY pd.advisor_user_id
    `, [atlanta.id]);

    console.log(`\n📅 Latest upload date: ${latestResult.rows[0]?.upload_date.toISOString().split('T')[0]}`);
    console.log(`Found ${latestResult.rows.length} advisor records in latest upload:\n`);

    let totalAlignments = 0;
    let nonZeroAdvisors = 0;
    
    latestResult.rows.forEach((row, index) => {
      const alignments = parseInt(row.alignments) || 0;
      const sales = parseFloat(row.sales) || 0;
      totalAlignments += alignments;
      
      if (alignments > 0) nonZeroAdvisors++;
      
      console.log(`${index + 1}. ID: ${row.advisor_user_id || 'NULL'} | ${row.advisor_name || 'Unknown'} | ${alignments} alignments | $${sales} sales`);
    });

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total alignments: ${totalAlignments}`);
    console.log(`   Advisors with alignments > 0: ${nonZeroAdvisors}`);
    console.log(`   Total advisor records: ${latestResult.rows.length}`);
    
    // Check if user might be referring to one specific advisor
    const advisorsWithAlignments = latestResult.rows.filter(row => parseInt(row.alignments) > 0);
    if (advisorsWithAlignments.length > 0) {
      console.log(`\n🎯 Advisors with alignments:`);
      advisorsWithAlignments.forEach(row => {
        console.log(`   ${row.advisor_name || 'Unknown'}: ${row.alignments} alignments`);
      });
    }
    
    // Check for any advisor with exactly 12 alignments
    const advisor12 = latestResult.rows.find(row => parseInt(row.alignments) === 12);
    if (advisor12) {
      console.log(`\n✅ Found advisor with exactly 12 alignments: ${advisor12.advisor_name || 'Unknown'}`);
    } else {
      console.log(`\n❌ No advisor has exactly 12 alignments`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAtlantaDetailed();