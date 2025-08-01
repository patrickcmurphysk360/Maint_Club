const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',  // Use localhost since we're connecting from outside Docker
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function resetAdminPassword() {
  try {
    console.log('🔄 Resetting admin password...');
    
    // Hash the new password
    const newPassword = 'admin123';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the admin user
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [hashedPassword, 'admin@example.com']
    );
    
    if (result.rowCount > 0) {
      console.log('✅ Admin password reset successfully!');
      console.log('📧 Email: admin@example.com');
      console.log('🔑 Password: admin123');
    } else {
      console.log('❌ Admin user not found');
    }
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();