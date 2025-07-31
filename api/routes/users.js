const express = require('express');
const router = express.Router();

// GET /api/users/advisors - Get all advisors for admin to select
router.get('/advisors', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
      SELECT DISTINCT 
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.status, u.role,
        us.store_name as "storeName", us.store_id as "storeId",
        um.market_name as "marketName", um.market_id as "marketId"
      FROM users u
      LEFT JOIN user_stores us ON u.id = us.user_id
      LEFT JOIN user_markets um ON u.id = um.user_id
      WHERE u.role = 'advisor' AND u.status = 'active'
      ORDER BY u.first_name, u.last_name
    `;
    
    const result = await pool.query(query);
    
    // Group advisor data by user
    const advisorsMap = new Map();
    result.rows.forEach(row => {
      if (!advisorsMap.has(row.id)) {
        advisorsMap.set(row.id, {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          status: row.status,
          role: row.role,
          stores: [],
          markets: []
        });
      }
      
      const advisor = advisorsMap.get(row.id);
      if (row.storeName && !advisor.stores.find(s => s.id === row.storeId)) {
        advisor.stores.push({ id: row.storeId, name: row.storeName });
      }
      if (row.marketName && !advisor.markets.find(m => m.id === row.marketId)) {
        advisor.markets.push({ id: row.marketId, name: row.marketName });
      }
    });
    
    const advisors = Array.from(advisorsMap.values());
    
    res.json(advisors);
  } catch (error) {
    console.error('Error fetching advisors:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/advisors/:id - Get specific advisor details
router.get('/advisors/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.status, u.role, u.created_at as "createdAt"
      FROM users u
      WHERE u.id = $1 AND u.role = 'advisor'
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Advisor not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching advisor:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/with-performance-data - Get users who have performance data
router.get('/with-performance-data', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    console.log('🔍 API DEBUG: with-performance-data called, user role:', role);
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager', 'market_manager', 'store_manager'].includes(role)) {
      console.log('🔍 API DEBUG: Access denied for role:', role);
      return res.status(403).json({ message: 'Access denied' });
    }
    
    console.log('🔍 API DEBUG: Permission granted, fetching users...');
    
    const query = `
      SELECT DISTINCT
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.role, u.status, u.is_vendor as "isVendor", 
        u.created_at as "createdAt", u.mobile, u.vendor,
        s.name as store_name, s.id as store_id,
        m.name as market_name, m.id as market_id
      FROM users u
      INNER JOIN performance_data pd ON pd.advisor_user_id = u.id
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
      LEFT JOIN markets m ON uma.market_id::integer = m.id
      WHERE u.status = 'active' AND pd.data_type = 'services'
      ORDER BY u.first_name, u.last_name
    `;
    
    const result = await pool.query(query);
    
    console.log('🔍 API DEBUG: Found', result.rows.length, 'users with performance data');
    
    // Group users and their assignments
    const usersMap = new Map();
    result.rows.forEach(row => {
      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          role: row.role,
          status: row.status,
          isVendor: row.isVendor,
          createdAt: row.createdAt,
          store_assignments: [],
          market_assignments: []
        });
      }
      
      const user = usersMap.get(row.id);
      if (row.store_name && !user.store_assignments.find(s => s.store_id === row.store_id)) {
        user.store_assignments.push({
          store_id: row.store_id,
          store_name: row.store_name,
          market_name: row.market_name
        });
      }
      if (row.market_name && !user.market_assignments.find(m => m.market_id === row.market_id)) {
        user.market_assignments.push({
          market_id: row.market_id,
          market_name: row.market_name
        });
      }
    });
    
    const finalUsers = Array.from(usersMap.values());
    console.log('🔍 API DEBUG: Returning', finalUsers.length, 'users to frontend');
    
    res.json(finalUsers);
  } catch (error) {
    console.error('❌ API ERROR: Error fetching users with performance data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users - Get all users (admin only)
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { role: filterRole, status } = req.query;
    
    // Check permissions - only admin can view all users
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
      SELECT DISTINCT
        u.id, u.first_name as "firstName", u.last_name as "lastName", 
        u.email, u.role, u.status, u.is_vendor as "isVendor", 
        u.created_at as "createdAt", u.mobile, u.vendor,
        s.name as store_name, s.id as store_id,
        m.name as market_name, m.id as market_id
      FROM users u
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
      LEFT JOIN markets m ON uma.market_id::integer = m.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (filterRole) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(filterRole);
    }
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY u.first_name, u.last_name`;
    
    const result = await pool.query(query, params);
    
    // Group users and their assignments
    const usersMap = new Map();
    result.rows.forEach(row => {
      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          role: row.role,
          status: row.status,
          isVendor: row.isVendor,
          createdAt: row.createdAt,
          store_assignments: [],
          market_assignments: []
        });
      }
      
      const user = usersMap.get(row.id);
      if (row.store_name && !user.store_assignments.find(s => s.store_id === row.store_id)) {
        user.store_assignments.push({
          store_id: row.store_id,
          store_name: row.store_name,
          market_name: row.market_name
        });
      }
      if (row.market_name && !user.market_assignments.find(m => m.market_id === row.market_id)) {
        user.market_assignments.push({
          market_id: row.market_id,
          market_name: row.market_name
        });
      }
    });
    
    res.json(Array.from(usersMap.values()));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:id - Get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const query = `
      SELECT DISTINCT
        u.id, u.first_name, u.last_name, u.email, u.role, u.status, 
        u.mobile, u.vendor, u.created_at,
        s.name as store_name, s.id as store_id,
        m.name as market_name, m.id as market_id
      FROM users u
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN user_market_assignments uma ON u.id::text = uma.user_id
      LEFT JOIN markets m ON uma.market_id::integer = m.id
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Group user data
    const userData = {
      id: result.rows[0].id,
      first_name: result.rows[0].first_name,
      last_name: result.rows[0].last_name,
      email: result.rows[0].email,
      role: result.rows[0].role,
      status: result.rows[0].status,
      mobile: result.rows[0].mobile,
      vendor: result.rows[0].vendor,
      created_at: result.rows[0].created_at,
      store_assignments: [],
      market_assignments: []
    };
    
    // Add store and market assignments
    result.rows.forEach(row => {
      if (row.store_id && !userData.store_assignments.find(s => s.store_id === row.store_id)) {
        userData.store_assignments.push({
          store_id: row.store_id,
          store_name: row.store_name
        });
      }
      if (row.market_id && !userData.market_assignments.find(m => m.market_id === row.market_id)) {
        userData.market_assignments.push({
          market_id: row.market_id,
          market_name: row.market_name
        });
      }
    });
    
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions - only admin can create users
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const {
      first_name,
      last_name,
      email,
      mobile,
      role: userRole = 'advisor',
      vendor,
      status = 'active',
      password = 'temppass123',
      store_assignments = [],
      market_assignments = []
    } = req.body;
    
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ 
        message: 'First name, last name, and email are required' 
      });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Hash password
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const userResult = await client.query(`
        INSERT INTO users (first_name, last_name, email, role, status, mobile, vendor, password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [first_name, last_name, email, userRole, status, mobile, vendor, hashedPassword]);
      
      const newUser = userResult.rows[0];
      const userId = newUser.id;
      
      // Add store assignments
      for (const storeId of store_assignments) {
        await client.query(`
          INSERT INTO user_store_assignments (user_id, store_id) 
          VALUES ($1, $2)
        `, [userId.toString(), storeId.toString()]);
      }
      
      // Add market assignments
      for (const marketId of market_assignments) {
        await client.query(`
          INSERT INTO user_market_assignments (user_id, market_id) 
          VALUES ($1, $2)
        `, [userId.toString(), marketId.toString()]);
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        id: newUser.id,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        mobile: newUser.mobile,
        vendor: newUser.vendor,
        message: 'User created successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ 
          message: 'User with this email already exists' 
        });
      }
      
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/:id - Update user with market and store assignments
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { role } = req.user;
    
    // Check permissions - only admin can update users
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const {
      firstName,
      lastName,
      first_name,
      last_name,
      email,
      mobile,
      role: userRole,
      vendor,
      status,
      password,
      markets = [],
      stores = [],
      market_assignments = [],
      store_assignments = []
    } = req.body;
    
    // Handle both naming conventions
    const finalFirstName = firstName || first_name;
    const finalLastName = lastName || last_name;
    const finalMarkets = markets.length > 0 ? markets : market_assignments;
    const finalStores = stores.length > 0 ? stores : store_assignments;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update user basic info
      let updateQuery = `
        UPDATE users 
        SET first_name = $2, last_name = $3, email = $4, role = $5, status = $6
      `;
      let params = [id, finalFirstName, finalLastName, email, userRole, status];
      let paramCount = 6;
      
      if (mobile !== undefined) {
        paramCount++;
        updateQuery += `, mobile = $${paramCount}`;
        params.push(mobile);
      }
      
      if (vendor !== undefined) {
        paramCount++;
        updateQuery += `, vendor = $${paramCount}`;
        params.push(vendor);
      }
      
      if (password) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        paramCount++;
        updateQuery += `, password = $${paramCount}`;
        params.push(hashedPassword);
      }
      
      updateQuery += ` WHERE id = $1 RETURNING *`;
      
      const userResult = await client.query(updateQuery, params);
      
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update market assignments
      if (finalMarkets.length >= 0) {
        // Remove existing market assignments
        await client.query('DELETE FROM user_market_assignments WHERE user_id = $1', [id]);
        
        // Add new market assignments
        for (const marketId of finalMarkets) {
          await client.query(`
            INSERT INTO user_market_assignments (user_id, market_id) 
            VALUES ($1, $2)
          `, [id.toString(), marketId.toString()]);
        }
      }
      
      // Update store assignments
      if (finalStores.length >= 0) {
        // Remove existing store assignments
        await client.query('DELETE FROM user_store_assignments WHERE user_id = $1', [id]);
        
        // Add new store assignments
        for (const storeId of finalStores) {
          await client.query(`
            INSERT INTO user_store_assignments (user_id, store_id) 
            VALUES ($1, $2)
          `, [id.toString(), storeId.toString()]);
        }
      }
      
      await client.query('COMMIT');
      
      const updatedUser = userResult.rows[0];
      res.json({
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        mobile: updatedUser.mobile,
        vendor: updatedUser.vendor,
        message: 'User updated successfully'
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

module.exports = router;