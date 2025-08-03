const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function processJuneMappings() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Processing June 2025 advisor mappings...');
    
    // The 3 unmapped advisors that need attention
    const unmappedAdvisors = [
      { name: 'BILL ALLEN', store: 'Mcdonough', market: 'Tire South - Tekmetric' },
      { name: 'MICHAEL SPENCER', store: 'Jonesboro', market: 'Tire South - Tekmetric' },
      { name: 'JACOB FUHRER', store: 'Roswell', market: 'Tire South - Tekmetric' }
    ];
    
    // Get the market ID
    const marketResult = await client.query(
      'SELECT id FROM markets WHERE name = $1',
      ['Tire South - Tekmetric']
    );
    
    if (marketResult.rows.length === 0) {
      throw new Error('Market "Tire South - Tekmetric" not found');
    }
    
    const marketId = marketResult.rows[0].id;
    console.log(`📍 Market ID: ${marketId}`);
    
    // Process each unmapped advisor
    for (const advisor of unmappedAdvisors) {
      console.log(`\n👤 Processing ${advisor.name}...`);
      
      // Get store ID
      const storeResult = await client.query(
        'SELECT id FROM stores WHERE name = $1 AND market_id = $2',
        [advisor.store, marketId]
      );
      
      if (storeResult.rows.length === 0) {
        console.warn(`⚠️ Store "${advisor.store}" not found for ${advisor.name}`);
        continue;
      }
      
      const storeId = storeResult.rows[0].id;
      
      // Create new user for this advisor
      const nameParts = advisor.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      const email = `${advisor.name.toLowerCase().replace(/\s+/g, '.')}@tiresouth.com`;
      const userId = `advisor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert new user
      const userResult = await client.query(`
        INSERT INTO users (user_id, first_name, last_name, email, role, status, password)
        VALUES ($1, $2, $3, $4, 'advisor', 'active', 'temporary_password')
        RETURNING id
      `, [userId, firstName, lastName, email]);
      
      const newUserId = userResult.rows[0].id;
      console.log(`✅ Created user: ${advisor.name} (ID: ${newUserId})`);
      
      // Create advisor mapping (check if exists first)
      const existingMapping = await client.query(
        'SELECT id FROM advisor_mappings WHERE spreadsheet_name = $1',
        [advisor.name]
      );
      
      if (existingMapping.rows.length > 0) {
        await client.query(`
          UPDATE advisor_mappings 
          SET user_id = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
          WHERE spreadsheet_name = $2
        `, [newUserId, advisor.name]);
      } else {
        await client.query(`
          INSERT INTO advisor_mappings (spreadsheet_name, user_id, is_active)
          VALUES ($1, $2, true)
        `, [advisor.name, newUserId]);
      }
      
      console.log(`📝 Created advisor mapping: ${advisor.name} -> ${newUserId}`);
      
      // Create user-store assignment
      await client.query(`
        INSERT INTO user_store_assignments (user_id, store_id, assigned_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, store_id) DO NOTHING
      `, [newUserId, storeId]);
      
      // Create user-market assignment
      await client.query(`
        INSERT INTO user_market_assignments (user_id, market_id, assigned_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, market_id) DO NOTHING
      `, [newUserId, marketId]);
      
      console.log(`🔗 Assigned ${advisor.name} to store "${advisor.store}" and market "${advisor.market}"`);
    }
    
    console.log('\n✅ All June 2025 advisor mappings processed successfully!');
    console.log('You can now process the upload session without manual mapping.');
    
  } catch (error) {
    console.error('❌ Error processing mappings:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
processJuneMappings();