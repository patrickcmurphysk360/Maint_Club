const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'admin',
  password: 'ducks2020'
});

async function checkAdminUser() {
  try {
    console.log('=== CHECKING ADMIN USER ===\n');
    
    // Check for admin users
    const adminResult = await pool.query(`
      SELECT id, first_name, last_name, email, role, status 
      FROM users 
      WHERE role = 'admin' OR role = 'administrator'
      ORDER BY id
    `);
    
    console.log('Admin users found:');
    console.table(adminResult.rows);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ No admin users found! Creating one...');
      
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const createResult = await pool.query(`
        INSERT INTO users (first_name, last_name, email, role, status, password)
        VALUES ('Admin', 'User', 'admin@maintenance.club', 'admin', 'active', $1)
        RETURNING id, email, role
      `, [hashedPassword]);
      
      console.log('✅ Admin user created:');
      console.table(createResult.rows);
    }
    
    // Also check what login endpoint expects
    console.log('\n=== LOGIN TEST ===');
    console.log('You can now login with:');
    console.log('Email: admin@maintenance.club');
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminUser();