const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function generateJuneStoreData() {
  const client = await pool.connect();
  
  try {
    console.log('🏪 Generating store-level data for June 2025...\n');
    
    // Get all stores that have advisor data for June 2025
    const storesWithData = await client.query(`
      SELECT DISTINCT 
        pd.store_id,
        pd.market_id,
        s.name as store_name,
        m.name as market_name
      FROM performance_data pd
      JOIN stores s ON pd.store_id = s.id
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NOT NULL
      ORDER BY s.name
    `);
    
    console.log(`Found ${storesWithData.rows.length} stores with advisor data:`);
    storesWithData.rows.forEach(store => {
      console.log(`   ${store.store_name} (ID: ${store.store_id})`);
    });
    
    console.log('\nGenerating aggregated store-level records...\n');
    
    let createdCount = 0;
    
    for (const store of storesWithData.rows) {
      console.log(`📊 Processing ${store.store_name}...`);
      
      // Aggregate all advisor data for this store
      const aggregatedData = await client.query(`
        SELECT 
          SUM(CAST(COALESCE(data->>'allTires', '0') AS INTEGER)) as allTires,
          SUM(CAST(COALESCE(data->>'retailTires', '0') AS INTEGER)) as retailTires,
          SUM(CAST(COALESCE(data->>'tireProtection', '0') AS INTEGER)) as tireProtection,
          SUM(CAST(COALESCE(data->>'acService', '0') AS INTEGER)) as acService,
          SUM(CAST(COALESCE(data->>'wiperBlades', '0') AS INTEGER)) as wiperBlades,
          SUM(CAST(COALESCE(data->>'brakeService', '0') AS INTEGER)) as brakeService,
          SUM(CAST(COALESCE(data->>'brakeFlush', '0') AS INTEGER)) as brakeFlush,
          SUM(CAST(COALESCE(data->>'alignmentCheck', '0') AS INTEGER)) as alignmentCheck,
          SUM(CAST(COALESCE(data->>'alignmentService', '0') AS INTEGER)) as alignmentService,
          SUM(CAST(COALESCE(data->>'potentialAlignments', '0') AS INTEGER)) as potentialAlignments,
          SUM(CAST(COALESCE(data->>'potentialAlignmentsSold', '0') AS INTEGER)) as potentialAlignmentsSold,
          SUM(CAST(COALESCE(data->>'shocksStruts', '0') AS INTEGER)) as shocksStruts,
          COUNT(*) as advisor_count
        FROM performance_data 
        WHERE upload_date = '2025-06-30' 
        AND store_id = $1 
        AND advisor_user_id IS NOT NULL
      `, [store.store_id]);
      
      const aggregated = aggregatedData.rows[0];
      
      // Calculate percentages
      const tireProtectionPercent = aggregated.retailtires > 0 ? 
        Math.ceil((aggregated.tireprotection / aggregated.retailtires) * 100) : 0;
      
      const brakeFlushToServicePercent = aggregated.brakeservice > 0 ? 
        Math.ceil((aggregated.brakeflush / aggregated.brakeservice) * 100) : 0;
      
      const potentialAlignmentsPercent = aggregated.potentialalignments > 0 ? 
        Math.ceil((aggregated.potentialalignmentssold / aggregated.potentialalignments) * 100) : 0;
      
      // Create store-level aggregated record
      const storeData = {
        storeName: store.store_name,
        market: store.market_name,
        allTires: aggregated.alltires,
        retailTires: aggregated.retailtires,
        tireProtection: aggregated.tireprotection,
        tireProtectionPercent: tireProtectionPercent,
        acService: aggregated.acservice,
        wiperBlades: aggregated.wiperblades,
        brakeService: aggregated.brakeservice,
        brakeFlush: aggregated.brakeflush,
        brakeFlushToServicePercent: brakeFlushToServicePercent,
        alignmentCheck: aggregated.alignmentcheck,
        alignmentService: aggregated.alignmentservice,
        potentialAlignments: aggregated.potentialalignments,
        potentialAlignmentsSold: aggregated.potentialalignmentssold,
        potentialAlignmentsPercent: potentialAlignmentsPercent,
        shocksStruts: aggregated.shocksstruts,
        advisorCount: parseInt(aggregated.advisor_count)
      };
      
      // Insert the store-level record
      await client.query(`
        INSERT INTO performance_data 
        (upload_date, data_type, market_id, store_id, advisor_user_id, data)
        VALUES ($1, 'services', $2, $3, NULL, $4)
      `, [
        '2025-06-30',
        store.market_id,
        store.store_id,
        JSON.stringify(storeData)
      ]);
      
      console.log(`   ✅ Created store record: ${aggregated.alltires} tires, ${aggregated.advisor_count} advisors`);
      createdCount++;
    }
    
    console.log(`\n✅ Generated ${createdCount} store-level records for June 2025!`);
    
    // Verify the results
    const verificationResult = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN advisor_user_id IS NOT NULL THEN 1 END) as advisor_level,
        COUNT(CASE WHEN advisor_user_id IS NULL AND store_id IS NOT NULL THEN 1 END) as store_level
      FROM performance_data 
      WHERE upload_date = '2025-06-30'
    `);
    
    const verification = verificationResult.rows[0];
    console.log(`\n🔍 Verification for June 2025:`);
    console.log(`   Total records: ${verification.total_records}`);
    console.log(`   Advisor-level: ${verification.advisor_level}`);
    console.log(`   Store-level: ${verification.store_level}`);
    
    if (verification.store_level > 0) {
      console.log('\n🎉 Store-level data generated successfully!');
      console.log('Store and market scorecards should now show June 2025 data.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

generateJuneStoreData();