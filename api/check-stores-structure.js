const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function checkStoresStructure() {
  console.log('🔍 Checking Stores Table Structure\n');
  
  try {
    // Check stores table structure
    console.log('1. Stores table columns:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stores'
      ORDER BY ordinal_position
    `);
    
    columnsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // Check McDonough stores
    console.log('\n2. McDonough stores:');
    const storesResult = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.city,
        s.state,
        m.name as market_name
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE LOWER(s.name) LIKE '%mcdonough%' 
         OR LOWER(s.city) LIKE '%mcdonough%'
      ORDER BY s.name
    `);
    
    console.log(`Found ${storesResult.rows.length} McDonough-related stores:`);
    storesResult.rows.forEach(store => {
      console.log(`  ${store.name} (ID: ${store.id}) - ${store.city}, ${store.state}`);
      console.log(`    Market: ${store.market_name}`);
    });
    
    // Check users assigned to McDonough
    console.log('\n3. Users assigned to McDonough stores:');
    const usersResult = await pool.query(`
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.role,
        s.name as store_name,
        s.id as store_id
      FROM users u
      JOIN user_store_assignments usa ON u.id::text = usa.user_id
      JOIN stores s ON usa.store_id::integer = s.id
      WHERE LOWER(s.name) LIKE '%mcdonough%' 
         OR LOWER(s.city) LIKE '%mcdonough%'
      ORDER BY u.role, u.last_name
    `);
    
    console.log(`Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(user => {
      console.log(`  ${user.first_name} ${user.last_name} - ${user.role} (Store: ${user.store_name})`);
    });
    
    // Check if there are any managers in the system
    console.log('\n4. All managers in the system:');
    const managersResult = await pool.query(`
      SELECT DISTINCT
        u.first_name,
        u.last_name,
        u.role,
        s.name as store_name
      FROM users u
      JOIN user_store_assignments usa ON u.id::text = usa.user_id
      JOIN stores s ON usa.store_id::integer = s.id
      WHERE u.role LIKE '%manager%'
      ORDER BY s.name, u.last_name
    `);
    
    console.log(`Found ${managersResult.rows.length} managers:`);
    managersResult.rows.forEach(manager => {
      console.log(`  ${manager.first_name} ${manager.last_name} - ${manager.role} (${manager.store_name})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking stores structure:', error);
  } finally {
    await pool.end();
  }
}

checkStoresStructure();