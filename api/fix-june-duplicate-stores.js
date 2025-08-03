const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function fixJuneDuplicateStores() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing duplicate store-level records for June 2025...\n');
    
    // First, let's see what we have
    console.log('📊 Current duplicate situation:');
    const duplicates = await client.query(`
      SELECT 
        store_id,
        s.name as store_name,
        COUNT(*) as record_count,
        ARRAY_AGG(pd.id ORDER BY pd.id) as record_ids,
        ARRAY_AGG(pd.data->>'invoices' ORDER BY pd.id) as invoices_values
      FROM performance_data pd
      JOIN stores s ON pd.store_id = s.id
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NULL
      AND pd.market_id = 694
      GROUP BY store_id, s.name
      HAVING COUNT(*) > 1
      ORDER BY s.name
    `);
    
    console.log(`Found ${duplicates.rows.length} stores with duplicates\n`);
    
    let deletedCount = 0;
    
    // For each store with duplicates
    for (const store of duplicates.rows) {
      console.log(`Processing ${store.store_name} (Store ID: ${store.store_id})`);
      console.log(`  Record IDs: ${store.record_ids.join(', ')}`);
      console.log(`  Invoice values: ${store.invoices_values.join(', ')}`);
      
      // Keep the record with invoices data (not null), delete the one with null invoices
      const recordToKeep = store.invoices_values[0] !== 'null' ? store.record_ids[0] : store.record_ids[1];
      const recordToDelete = store.invoices_values[0] === 'null' ? store.record_ids[0] : store.record_ids[1];
      
      console.log(`  Keeping record ID: ${recordToKeep} (has invoice data)`);
      console.log(`  Deleting record ID: ${recordToDelete} (has null invoices)`);
      
      // Delete the duplicate record
      await client.query('DELETE FROM performance_data WHERE id = $1', [recordToDelete]);
      deletedCount++;
    }
    
    console.log(`\n✅ Deleted ${deletedCount} duplicate records`);
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    const verifyDuplicates = await client.query(`
      SELECT COUNT(*) as remaining_duplicates
      FROM (
        SELECT store_id, COUNT(*) as cnt
        FROM performance_data
        WHERE upload_date = '2025-06-30'
        AND advisor_user_id IS NULL
        AND market_id = 694
        GROUP BY store_id
        HAVING COUNT(*) > 1
      ) as dup
    `);
    
    console.log(`Remaining duplicates: ${verifyDuplicates.rows[0].remaining_duplicates}`);
    
    // Show new totals
    console.log('\n📊 New market aggregation after fix:');
    const newTotals = await client.query(`
      SELECT 
        SUM(CAST(pd.data->>'invoices' AS INTEGER)) as total_invoices,
        SUM(CAST(pd.data->>'sales' AS NUMERIC)) as total_sales,
        SUM(CAST(pd.data->>'allTires' AS INTEGER)) as total_all_tires,
        SUM(CAST(pd.data->>'retailTires' AS INTEGER)) as total_retail_tires,
        SUM(CAST(pd.data->>'tireProtection' AS INTEGER)) as total_tire_protection,
        SUM(CAST(pd.data->>'potentialAlignments' AS INTEGER)) as total_potential_alignments,
        SUM(CAST(pd.data->>'potentialAlignmentsSold' AS INTEGER)) as total_alignments_sold,
        SUM(CAST(pd.data->>'brakeService' AS INTEGER)) as total_brake_service,
        SUM(CAST(pd.data->>'brakeFlush' AS INTEGER)) as total_brake_flush
      FROM performance_data pd
      WHERE pd.upload_date = '2025-06-30'
      AND pd.advisor_user_id IS NULL
      AND pd.market_id = 694
    `);
    
    const totals = newTotals.rows[0];
    console.log(`   Invoices: ${totals.total_invoices}`);
    console.log(`   Sales: $${parseFloat(totals.total_sales).toFixed(2)}`);
    console.log(`   All Tires: ${totals.total_all_tires}`);
    console.log(`   Retail Tires: ${totals.total_retail_tires}`);
    console.log(`   Tire Protection: ${totals.total_tire_protection}`);
    console.log(`   Potential Alignments: ${totals.total_potential_alignments}`);
    console.log(`   Alignments Sold: ${totals.total_alignments_sold}`);
    console.log(`   Brake Service: ${totals.total_brake_service}`);
    console.log(`   Brake Flush: ${totals.total_brake_flush}`);
    
    console.log('\n✅ Market scorecard should now match the spreadsheet market tab!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixJuneDuplicateStores();