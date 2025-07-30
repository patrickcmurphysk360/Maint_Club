const express = require('express');
const router = express.Router();

// =========================================
// STORE MANAGEMENT ROUTES FOR PHASE 1
// =========================================

// GET /api/phase1/stores - Get all stores with market info
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { market_id, status } = req.query;
    
    // Check permissions and apply role-based filtering
    let query = `
      SELECT 
        s.id as store_id,
        s.name as store_name,
        s.market_id,
        m.name as market_name,
        s.address,
        s.phone,
        'active' as status,
        s.created_at,
        COALESCE(m.vendor_tags, '{}') as market_vendor_tags
      FROM stores s
      JOIN markets m ON m.id = s.market_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Filter by market if provided
    if (market_id) {
      query += ` AND s.market_id = $${paramIndex}`;
      params.push(market_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Apply role-based access control
    if (req.user.role === 'vendor_partner') {
      query += ` AND $${paramIndex} = ANY(COALESCE(m.vendor_tags, '{}'))`;
      params.push(req.user.vendor);
      paramIndex++;
    } else if (req.user.role === 'market_manager') {
      query += ` AND s.market_id::text IN (SELECT market_id FROM user_market_assignments WHERE user_id = $${paramIndex})`;
      params.push(req.user.user_id);
      paramIndex++;
    } else if (req.user.role === 'store_manager') {
      query += ` AND s.id IN (SELECT store_id FROM user_store_assignments WHERE user_id = $${paramIndex})`;
      params.push(req.user.user_id);
      paramIndex++;
    }
    
    query += ` ORDER BY m.name, s.name`;
    
    const result = await pool.query(query, params);
    
    res.json({
      stores: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/stores/:storeId - Get specific store
router.get('/:storeId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId } = req.params;
    
    // Check access permissions
    let accessQuery = `
      SELECT s.*, m.name as market_name, m.vendor_tags as market_vendor_tags
      FROM stores s
      JOIN markets m ON m.id = s.market_id
      WHERE s.id = $1
    `;
    const accessParams = [storeId];
    
    if (req.user.role === 'vendor_partner') {
      accessQuery += ' AND $2 = ANY(COALESCE(m.vendor_tags, \'{}\'))';
      accessParams.push(req.user.vendor);
    } else if (req.user.role === 'market_manager') {
      accessQuery += ' AND s.market_id::text IN (SELECT market_id FROM user_market_assignments WHERE user_id = $2)';
      accessParams.push(req.user.user_id);
    } else if (req.user.role === 'store_manager') {
      accessQuery += ' AND s.id IN (SELECT store_id FROM user_store_assignments WHERE user_id = $2)';
      accessParams.push(req.user.user_id);
    } else if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const storeResult = await pool.query(accessQuery, accessParams);
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found or access denied' });
    }
    
    // Get assigned users
    const usersResult = await pool.query(`
      SELECT 
        u.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email,
        u.role,
        usa.assigned_at
      FROM user_store_assignments usa
      JOIN users u ON u.user_id = usa.user_id
      WHERE usa.store_id = $1
      ORDER BY u.first_name, u.last_name
    `, [storeId]);
    
    // Get advisors mapped to this store
    const advisorsResult = await pool.query(`
      SELECT 
        am.employee_name,
        u.user_id,
        u.name as mapped_user_name,
        u.email,
        am.created_at as mapped_at
      FROM advisor_mappings am
      LEFT JOIN users u ON u.user_id = am.user_id
      WHERE am.store_name = $1
      ORDER BY am.employee_name
    `, [storeResult.rows[0].name]);
    
    const store = storeResult.rows[0];
    store.assigned_users = usersResult.rows;
    store.advisor_mappings = advisorsResult.rows;
    
    res.json(store);
    
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/stores - Create new store
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { store_id, store_name, market_id, address, phone } = req.body;
    
    // Check permissions - only admin can create stores
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Validate required fields
    if (!store_name || !market_id) {
      return res.status(400).json({ message: 'Store name and market ID are required' });
    }
    
    // Verify market exists
    const marketCheck = await pool.query('SELECT id, name FROM markets WHERE id = $1', [market_id]);
    if (marketCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    // Generate store_id if not provided
    const finalStoreId = store_id || `store_${store_name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const result = await pool.query(`
      INSERT INTO stores (name, market_id, address, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING id as store_id, name as store_name, market_id, address, phone, created_at
    `, [store_name, market_id, address, phone]);
    
    const newStore = result.rows[0];
    newStore.market_name = marketCheck.rows[0].name;
    
    res.status(201).json({
      message: 'Store created successfully',
      store: newStore
    });
    
  } catch (error) {
    console.error('Error creating store:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Store with this ID already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// PUT /api/phase1/stores/:storeId - Update store
router.put('/:storeId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId } = req.params;
    const { store_name, market_id, address, phone, status } = req.body;
    
    // Check permissions - only admin can update stores
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Verify market exists if changing market
    if (market_id) {
      const marketCheck = await pool.query('SELECT id FROM markets WHERE id = $1', [market_id]);
      if (marketCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Market not found' });
      }
    }
    
    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (store_name) {
      updates.push(`name = $${paramIndex}`);
      params.push(store_name);
      paramIndex++;
    }
    
    if (market_id) {
      updates.push(`market_id = $${paramIndex}`);
      params.push(market_id);
      paramIndex++;
    }
    
    if (address !== undefined) {
      updates.push(`address = $${paramIndex}`);
      params.push(address);
      paramIndex++;
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(phone);
      paramIndex++;
    }
    
    if (status) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    params.push(storeId);
    const updateQuery = `
      UPDATE stores 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id as store_id, name as store_name, market_id, address, phone
    `;
    
    const result = await pool.query(updateQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    res.json({
      message: 'Store updated successfully',
      store: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/phase1/stores/:storeId - Delete store
router.delete('/:storeId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId } = req.params;
    
    // Check permissions - only admin can delete stores
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if store has advisor mappings
    const mappingCheck = await pool.query(`
      SELECT COUNT(*) as count FROM advisor_mappings am
      JOIN stores s ON s.name = am.store_name
      WHERE s.id = $1
    `, [storeId]);
    
    if (parseInt(mappingCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete store with existing advisor mappings' });
    }
    
    const result = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING id', [storeId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    res.json({ message: 'Store deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/stores/:storeId/assign-user - Assign user to store
router.post('/:storeId/assign-user', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId } = req.params;
    const { user_id } = req.body;
    
    // Check permissions - only admin can assign users
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Verify store exists
    const storeCheck = await pool.query('SELECT id FROM stores WHERE id = $1', [storeId]);
    if (storeCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    // Verify user exists
    const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Assign user to store
    await pool.query(`
      INSERT INTO user_store_assignments (user_id, store_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, store_id) DO NOTHING
    `, [user_id, storeId]);
    
    res.json({ message: 'User assigned to store successfully' });
    
  } catch (error) {
    console.error('Error assigning user to store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/phase1/stores/:storeId/unassign-user/:userId - Remove user from store
router.delete('/:storeId/unassign-user/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { storeId, userId } = req.params;
    
    // Check permissions - only admin can unassign users
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      DELETE FROM user_store_assignments 
      WHERE user_id = $1 AND store_id = $2
      RETURNING id
    `, [userId, storeId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    res.json({ message: 'User unassigned from store successfully' });
    
  } catch (error) {
    console.error('Error unassigning user from store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;