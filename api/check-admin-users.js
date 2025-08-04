const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function checkAdminUsers() {
  try {
    console.log('🔍 Checking admin users in database...\n');
    
    // Get all admin users
    const result = await pool.query(`
      SELECT id, email, role, status, created_at 
      FROM users 
      WHERE role IN ('admin', 'administrator') 
      ORDER BY id
    `);
    
    console.log('📋 Admin users found:');
    if (result.rows.length === 0) {
      console.log('❌ No admin users found in database');
    } else {
      console.table(result.rows);
    }
    
    // Check specifically for admin@example.com
    console.log('\n🔍 Checking for admin@example.com...');
    const adminCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@example.com']);
    
    if (adminCheck.rows.length > 0) {
      const user = adminCheck.rows[0];
      console.log('✅ admin@example.com found:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Role:', user.role);
      console.log('   Status:', user.status);
      console.log('   Password hash exists:', !!user.password);
      console.log('   Created:', user.created_at);
      
      // Test password verification
      if (user.password) {
        console.log('\n🔐 Testing password verification...');
        const testPasswords = ['admin123', 'password', 'test123', 'admin', 'ducks2020'];
        
        for (const testPass of testPasswords) {
          try {
            const isValid = await bcrypt.compare(testPass, user.password);
            if (isValid) {
              console.log(`✅ Password '${testPass}' is VALID`);
            } else {
              console.log(`❌ Password '${testPass}' is invalid`);
            }
          } catch (error) {
            console.log(`❌ Error testing password '${testPass}':`, error.message);
          }
        }
      }
    } else {
      console.log('❌ admin@example.com not found in database');
      
      // Show available admin emails
      if (result.rows.length > 0) {
        console.log('\n📧 Available admin emails:');
        result.rows.forEach(user => {
          console.log(`   - ${user.email} (${user.role})`);
        });
      }
      
      // Create admin@example.com user
      console.log('\n🔧 Creating admin@example.com user...');
      try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const insertResult = await pool.query(`
          INSERT INTO users (email, password, role, status, first_name, last_name)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, email, role
        `, ['admin@example.com', hashedPassword, 'admin', 'active', 'Admin', 'User']);
        
        console.log('✅ Admin user created successfully:');
        console.log('   Email: admin@example.com');
        console.log('   Password: admin123');
        console.log('   Role:', insertResult.rows[0].role);
        console.log('   ID:', insertResult.rows[0].id);
        
      } catch (createError) {
        console.error('❌ Error creating admin user:', createError.message);
      }
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkAdminUsers();