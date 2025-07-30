const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// =========================================
// USER MANAGEMENT ROUTES FOR PHASE 1
// =========================================

// GET /api/phase1/users - Get all users with role-based filtering
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role, status, vendor } = req.query;
    
    // Check permissions - only admin and market_manager can list users
    if (!['administrator', 'market_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
      SELECT 
        u.id::varchar as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.mobile,
        u.role,
        u.vendor,
        u.status,
        u.created_at,
        u.last_login,
        COALESCE(
          json_agg(DISTINCT 
            jsonb_build_object(
              'market_id', m.id, 
              'market_name', m.name
            )
          ) FILTER (WHERE m.id IS NOT NULL), 
          '[]'::json
        ) as assigned_markets,
        COALESCE(
          json_agg(DISTINCT 
            jsonb_build_object(
              'store_id', s.id, 
              'store_name', s.name
            )
          ) FILTER (WHERE s.id IS NOT NULL), 
          '[]'::json
        ) as assigned_stores
      FROM users u
      LEFT JOIN advisor_mappings am ON u.id = am.user_id AND am.is_active = true
      LEFT JOIN markets m ON am.market_id = m.id
      LEFT JOIN stores s ON am.store_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (vendor) {
      query += ` AND vendor = $${paramIndex}`;
      params.push(vendor);
      paramIndex++;
    }
    
    query += ` 
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.mobile, 
               u.role, u.vendor, u.status, u.created_at, u.last_login
      ORDER BY u.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      users: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/users/:userId - Get specific user
router.get('/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    
    // Check permissions
    if (req.user.role !== 'administrator' && req.user.user_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        user_id,
        first_name,
        last_name,
        email,
        mobile,
        role,
        vendor,
        status,
        created_at,
        last_login
      FROM users 
      WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get market assignments
    const marketAssignments = await pool.query(`
      SELECT m.id as market_id, m.name as market_name, uma.assigned_at
      FROM user_market_assignments uma
      JOIN markets m ON m.id::varchar = uma.market_id
      WHERE uma.user_id = $1
    `, [userId]);
    
    // Get store assignments
    const storeAssignments = await pool.query(`
      SELECT s.id as store_id, s.name as store_name, s.market_id, usa.assigned_at
      FROM user_store_assignments usa
      JOIN stores s ON s.id::varchar = usa.store_id
      WHERE usa.user_id = $1
    `, [userId]);
    
    const user = result.rows[0];
    user.market_assignments = marketAssignments.rows;
    user.store_assignments = storeAssignments.rows;
    
    res.json(user);
    
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/users - Create new user
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { user_id, first_name, last_name, email, mobile, password, role, vendor, markets, stores } = req.body;
    
    // Check permissions - only admin can create users
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Validate required fields
    if (!user_id || !first_name || !last_name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Validate role
    const validRoles = ['administrator', 'market_manager', 'store_manager', 'advisor', 'vendor_partner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    // Validate vendor for vendor_partner role
    if (role === 'vendor_partner' && !vendor) {
      return res.status(400).json({ message: 'Vendor is required for vendor_partner role' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT user_id FROM users WHERE email = $1 OR user_id = $2', [email, user_id]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      const userResult = await client.query(`
        INSERT INTO users (user_id, first_name, last_name, email, mobile, password, role, vendor, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
        RETURNING user_id, first_name, last_name, email, mobile, role, vendor, status, created_at
      `, [user_id, first_name, last_name, email, mobile, hashedPassword, role, vendor]);
      
      const newUser = userResult.rows[0];
      
      // Assign markets if provided
      if (markets && markets.length > 0) {
        for (const marketId of markets) {
          await client.query(`
            INSERT INTO user_market_assignments (user_id, market_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, market_id) DO NOTHING
          `, [user_id, marketId]);
        }
      }
      
      // Assign stores if provided
      if (stores && stores.length > 0) {
        for (const storeId of stores) {
          await client.query(`
            INSERT INTO user_store_assignments (user_id, store_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, store_id) DO NOTHING
          `, [user_id, storeId]);
        }
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        message: 'User created successfully',
        user: newUser
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'User with this email or ID already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// PUT /api/phase1/users/:userId - Update user
router.put('/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const { first_name, last_name, email, mobile, role, vendor, status, markets, stores, password } = req.body;
    
    // Check permissions - only admin can update users (except own profile)
    if (req.user.role !== 'administrator' && req.user.user_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Build update query
      const updates = [];
      const params = [];
      let paramIndex = 1;
      
      if (first_name) {
        updates.push(`first_name = $${paramIndex}`);
        params.push(first_name);
        paramIndex++;
      }
      
      if (last_name) {
        updates.push(`last_name = $${paramIndex}`);
        params.push(last_name);
        paramIndex++;
      }
      
      if (email) {
        updates.push(`email = $${paramIndex}`);
        params.push(email);
        paramIndex++;
      }
      
      if (mobile !== undefined) {
        updates.push(`mobile = $${paramIndex}`);
        params.push(mobile);
        paramIndex++;
      }
      
      if (role && req.user.role === 'administrator') { // Only admin can change roles
        updates.push(`role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }
      
      if (vendor !== undefined && req.user.role === 'administrator') {
        updates.push(`vendor = $${paramIndex}`);
        params.push(vendor);
        paramIndex++;
      }
      
      if (status && req.user.role === 'administrator') {
        updates.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
      
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push(`password = $${paramIndex}`);
        params.push(hashedPassword);
        paramIndex++;
      }
      
      if (updates.length > 0) {
        params.push(userId);
        const updateQuery = `
          UPDATE users 
          SET ${updates.join(', ')}
          WHERE user_id = $${paramIndex}
          RETURNING user_id, first_name, last_name, email, mobile, role, vendor, status
        `;
        
        const result = await client.query(updateQuery, params);
      }
      
      // Update market assignments if provided and user is admin
      if (markets && req.user.role === 'administrator') {
        // Remove existing assignments
        await client.query('DELETE FROM user_market_assignments WHERE user_id = $1', [userId]);
        
        // Add new assignments
        for (const marketId of markets) {
          await client.query(`
            INSERT INTO user_market_assignments (user_id, market_id)
            VALUES ($1, $2)
          `, [userId, marketId]);
        }
      }
      
      // Update store assignments if provided and user is admin
      if (stores && req.user.role === 'administrator') {
        // Remove existing assignments
        await client.query('DELETE FROM user_store_assignments WHERE user_id = $1', [userId]);
        
        // Add new assignments
        for (const storeId of stores) {
          await client.query(`
            INSERT INTO user_store_assignments (user_id, store_id)
            VALUES ($1, $2)
          `, [userId, storeId]);
        }
      }
      
      await client.query('COMMIT');
      
      // Fetch updated user
      const updatedUser = await pool.query(`
        SELECT user_id, first_name, last_name, email, role, vendor, status, created_at, last_login
        FROM users WHERE user_id = $1
      `, [userId]);
      
      res.json({
        message: 'User updated successfully',
        user: updatedUser.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/phase1/users/:userId - Delete user
router.delete('/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    
    // Check permissions - only admin can delete users
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Prevent self-deletion
    if (req.user.user_id === userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const result = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/users/roles/available - Get available roles
router.get('/roles/available', async (req, res) => {
  try {
    const roles = [
      { value: 'admin', label: 'Administrator', description: 'Full system access' },
      { value: 'market_manager', label: 'Market Manager', description: 'Manage assigned markets' },
      { value: 'store_manager', label: 'Store Manager', description: 'Manage assigned stores' },
      { value: 'advisor', label: 'Advisor', description: 'View own performance and coaching' },
      { value: 'vendor_partner', label: 'Vendor Partner', description: 'View markets tagged with vendor' }
    ];
    
    res.json({ roles });
    
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;