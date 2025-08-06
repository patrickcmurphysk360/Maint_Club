const { Pool } = require('pg');

async function testUserLookup() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'maintenance_club_mvp',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'ducks2020'
  });

  try {
    console.log('🔍 Looking for Cody Lanier in database...\n');
    
    // Search by name
    const nameResult = await pool.query(
      `SELECT id, first_name, last_name, email, role, status 
       FROM users 
       WHERE LOWER(first_name || ' ' || last_name) LIKE '%cody%lanier%'`
    );
    
    console.log('Found by name search:', nameResult.rows);
    
    // Search by exact ID
    const idResult = await pool.query(
      `SELECT id, first_name, last_name, email, role, status 
       FROM users 
       WHERE id = 244`
    );
    
    console.log('\nFound by ID 244:', idResult.rows);
    
    // Search similar names
    const similarResult = await pool.query(
      `SELECT id, first_name, last_name, email, role, status 
       FROM users 
       WHERE role = 'advisor' 
       AND (LOWER(first_name) LIKE '%cod%' OR LOWER(last_name) LIKE '%lan%')
       LIMIT 10`
    );
    
    console.log('\nSimilar advisor names:', similarResult.rows);
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

testUserLookup().catch(console.error);