const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function createMissingMappings() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating missing advisor mappings...\n');
    
    // The 3 advisors that need mappings
    const advisorsToMap = [
      { name: 'BILL ALLEN', store: 'Mcdonough' },
      { name: 'MICHAEL SPENCER', store: 'Jonesboro' },
      { name: 'JACOB FUHRER', store: 'Roswell' }
    ];
    
    // Get market and store IDs
    const marketResult = await client.query(
      'SELECT id FROM markets WHERE name = $1',
      ['Tire South - Tekmetric']
    );
    const marketId = marketResult.rows[0].id;
    
    for (const advisor of advisorsToMap) {
      console.log(`\n👤 Processing ${advisor.name}...`);
      
      // Check if user exists
      let userResult = await client.query(
        'SELECT id FROM users WHERE first_name = $1 AND last_name = $2',
        [advisor.name.split(' ')[0], advisor.name.split(' ').slice(1).join(' ')]
      );
      
      let userId;
      if (userResult.rows.length === 0) {
        // Create user
        const nameParts = advisor.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        const email = `${advisor.name.toLowerCase().replace(/\s+/g, '.')}@tiresouth.com`;
        const userIdString = `advisor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        userResult = await client.query(`
          INSERT INTO users (user_id, first_name, last_name, email, role, status, password)
          VALUES ($1, $2, $3, $4, 'advisor', 'active', 'temporary_password')
          RETURNING id
        `, [userIdString, firstName, lastName, email]);
        
        userId = userResult.rows[0].id;
        console.log(`✅ Created user: ${advisor.name} (ID: ${userId})`);
      } else {
        userId = userResult.rows[0].id;
        console.log(`✅ Found existing user: ${advisor.name} (ID: ${userId})`);
      }
      
      // Create or update advisor mapping
      const existingMapping = await client.query(
        'SELECT id FROM advisor_mappings WHERE spreadsheet_name = $1',
        [advisor.name]
      );
      
      if (existingMapping.rows.length > 0) {
        await client.query(`
          UPDATE advisor_mappings 
          SET user_id = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
          WHERE spreadsheet_name = $2
        `, [userId, advisor.name]);
        console.log(`📝 Updated advisor mapping: ${advisor.name} -> ${userId}`);
      } else {
        await client.query(`
          INSERT INTO advisor_mappings (spreadsheet_name, user_id, is_active)
          VALUES ($1, $2, true)
        `, [advisor.name, userId]);
        console.log(`📝 Created advisor mapping: ${advisor.name} -> ${userId}`);
      }
      
      // Get store ID and create assignments
      const storeResult = await client.query(
        'SELECT id FROM stores WHERE name = $1 AND market_id = $2',
        [advisor.store, marketId]
      );
      
      if (storeResult.rows.length > 0) {
        const storeId = storeResult.rows[0].id;
        
        // Create user-store assignment
        await client.query(`
          INSERT INTO user_store_assignments (user_id, store_id, assigned_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, store_id) DO NOTHING
        `, [userId, storeId]);
        
        // Create user-market assignment
        await client.query(`
          INSERT INTO user_market_assignments (user_id, market_id, assigned_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, market_id) DO NOTHING
        `, [userId, marketId]);
        
        console.log(`🔗 Created assignments for ${advisor.name}`);
      }
    }
    
    console.log('\n✅ All advisor mappings created!');
    console.log('Now running the data fix script...\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createMissingMappings();