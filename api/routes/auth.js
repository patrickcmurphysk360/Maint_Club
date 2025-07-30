const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Helper function to get Phase 1 permissions based on role
function getPhase1Permissions(role) {
  const permissions = {};
  
  switch (role) {
    case 'administrator':
      permissions.canViewScorecard = true;
      permissions.canSetGoals = true;
      permissions.canSendCoaching = true;
      permissions.canReceiveCoaching = false;
      permissions.canViewReports = true;
      permissions.canManageVendorMappings = true;
      permissions.canManageAdvisorMappings = true;
      permissions.canExportData = true;
      permissions.canManageUsers = true;
      permissions.canManageMarkets = true;
      permissions.canManageStores = true;
      break;
      
    case 'market_manager':
      permissions.canViewScorecard = true;
      permissions.canSetGoals = true;
      permissions.canSendCoaching = true;
      permissions.canReceiveCoaching = false;
      permissions.canViewReports = true;
      permissions.canManageVendorMappings = false;
      permissions.canManageAdvisorMappings = false;
      permissions.canExportData = true;
      permissions.canManageUsers = false;
      permissions.canManageMarkets = false;
      permissions.canManageStores = false;
      break;
      
    case 'store_manager':
      permissions.canViewScorecard = true;
      permissions.canSetGoals = true;
      permissions.canSendCoaching = true;
      permissions.canReceiveCoaching = false;
      permissions.canViewReports = true;
      permissions.canManageVendorMappings = false;
      permissions.canManageAdvisorMappings = false;
      permissions.canExportData = false;
      permissions.canManageUsers = false;
      permissions.canManageMarkets = false;
      permissions.canManageStores = false;
      break;
      
    case 'advisor':
      permissions.canViewScorecard = true;
      permissions.canSetGoals = false;
      permissions.canSendCoaching = false;
      permissions.canReceiveCoaching = true;
      permissions.canViewReports = false;
      permissions.canManageVendorMappings = false;
      permissions.canManageAdvisorMappings = false;
      permissions.canExportData = false;
      permissions.canManageUsers = false;
      permissions.canManageMarkets = false;
      permissions.canManageStores = false;
      break;
      
    case 'vendor_partner':
      permissions.canViewScorecard = true;
      permissions.canSetGoals = false;
      permissions.canSendCoaching = false;
      permissions.canReceiveCoaching = false;
      permissions.canViewReports = true;
      permissions.canManageVendorMappings = false;
      permissions.canManageAdvisorMappings = false;
      permissions.canExportData = true;
      permissions.canManageUsers = false;
      permissions.canManageMarkets = false;
      permissions.canManageStores = false;
      break;
      
    default:
      // No permissions for unknown roles
      break;
  }
  
  return permissions;
}

// Helper function to get user permissions based on role
async function getUserPermissions(userId, role, pool) {
  const permissions = {};
  
  try {
    // For market owners and market managers, get markets
    if (role === 'marketOwner' || role === 'marketManager') {
      const marketsResult = await pool.query(
        `SELECT market_name, is_owner FROM user_markets WHERE user_id = $1`,
        [userId]
      );
      permissions.markets = marketsResult.rows.map(row => row.market_name);
    }
    
    // For store managers and advisors, get stores
    if (role === 'storeManager' || role === 'advisor') {
      const storesResult = await pool.query(
        `SELECT store_name, is_manager FROM user_stores WHERE user_id = $1`,
        [userId]
      );
      permissions.stores = storesResult.rows.map(row => row.store_name);
    }
    
    // For market managers who are vendors, get vendor tags
    if (role === 'marketManager') {
      const userResult = await pool.query(
        'SELECT is_vendor FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length > 0 && userResult.rows[0].is_vendor) {
        const tagsResult = await pool.query(
          'SELECT tag_name FROM user_vendor_tags WHERE user_id = $1',
          [userId]
        );
        if (tagsResult.rows.length > 0) {
          permissions.vendorTags = tagsResult.rows.map(row => row.tag_name);
        }
      }
      
      const regionsResult = await pool.query(
        'SELECT region_name FROM user_regions WHERE user_id = $1',
        [userId]
      );
      if (regionsResult.rows.length > 0) {
        permissions.regions = regionsResult.rows.map(row => row.region_name);
      }
    }
    
    // For advisors, get their advisor mapping
    if (role === 'advisor') {
      const mappingResult = await pool.query(`
        SELECT 
          am.id as "mappingId",
          am.spreadsheet_name as "spreadsheetName",
          am.market_id as "marketId",
          am.store_id as "storeId",
          m.name as "marketName",
          s.name as "storeName"
        FROM advisor_mappings am
        LEFT JOIN markets m ON am.market_id = m.id
        LEFT JOIN stores s ON am.store_id = s.id
        WHERE am.user_id = $1 AND am.is_active = true
      `, [userId]);
      
      if (mappingResult.rows.length > 0) {
        permissions.advisorMappings = mappingResult.rows;
        permissions.canViewScorecard = true;
        permissions.canReceiveCoaching = true;
      }
    }
    
    // For managers and admin, add additional permissions
    if (['admin', 'marketManager', 'storeManager'].includes(role)) {
      permissions.canSetGoals = true;
      permissions.canSendCoaching = true;
      permissions.canViewReports = true;
      permissions.canManageVendorMappings = role === 'admin';
      permissions.canManageAdvisorMappings = role === 'admin';
      permissions.canExportData = true;
    }
    
    return permissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return {};
  }
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Find user by email
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, email, role, status, password FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const user = userResult.rows[0];
    
    // Check password
    const isTestEnv = process.env.NODE_ENV === 'development';
    let passwordMatch = false;
    
    if (isTestEnv && password === 'admin123') {
      // Development bypass
      passwordMatch = true;
    } else {
      // Normal password check
      passwordMatch = await bcrypt.compare(password, user.password);
    }
    
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Update last login time
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Get user's permissions based on role
    const permissions = getPhase1Permissions(user.role);
    
    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        user_id: user.id, // Include both for compatibility
        email: user.email, 
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '8h' }
    );
    
    // Return user info and token - Phase 1 compatible structure
    res.json({
      token,
      user: {
        id: user.id,
        user_id: user.id, // Phase 1 compatibility
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        isVendor: user.is_vendor,
        permissions: permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const pool = req.app.locals.pool;
    
    // Get fresh user info - try Phase 1 first, then MVP
    let userResult = await pool.query(
      `SELECT 
        user_id as id,
        user_id, 
        first_name as "firstName", 
        last_name as "lastName", 
        email, 
        role, 
        status,
        created_at as "createdAt"
      FROM users 
      WHERE user_id = $1 AND status = 'active'`,
      [decoded.user_id || decoded.id]
    );
    
    // If not found in Phase 1, try MVP structure
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        `SELECT 
          id, 
          first_name as "firstName", 
          last_name as "lastName", 
          email, 
          role, 
          status,
          is_vendor as "isVendor",
          last_login as "lastLogin", 
          created_at as "createdAt"
        FROM users 
        WHERE id = $1 AND status = 'active'`,
        [decoded.id]
      );
    }
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user's permissions
    let permissions = {};
    if (user.id && user.id.toString().startsWith('user_')) {
      // Phase 1 user - use role-based permissions
      permissions = getPhase1Permissions(user.role);
    } else {
      // MVP user - use complex permission system
      permissions = await getUserPermissions(user.id, user.role, pool);
    }
    user.permissions = permissions;
    
    res.json(user);
  } catch (error) {
    console.error('Error getting current user:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Server error' });  
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;