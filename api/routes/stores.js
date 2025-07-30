const express = require('express');
const router = express.Router();

// GET all stores with market info and user assignments
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { market_id } = req.query;
    
    let query = `
      SELECT 
        s.id,
        s.name,
        s.market_id,
        s.city,
        s.state,
        s.address,
        s.zip as zip_code,
        s.phone,
        s.created_at,
        m.name as market_name,
        COALESCE(
          STRING_AGG(
            CASE WHEN u.role = 'store_manager' 
            THEN u.first_name || ' ' || u.last_name 
            END, ', '
          ), 
          'Not assigned'
        ) as manager_name
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      LEFT JOIN user_store_assignments usa ON s.id::text = usa.store_id
      LEFT JOIN users u ON usa.user_id::integer = u.id
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
    
    // Apply role-based access control (temporarily disabled for testing)
    // TODO: Re-enable role-based filtering after debugging
    /*
    if (req.user.role === 'market_manager') {
      query += ` AND s.market_id::text IN (
        SELECT market_id FROM user_market_assignments 
        WHERE user_id = $${paramIndex}::text
      )`;
      params.push(req.user.id.toString());
      paramIndex++;
    } else if (req.user.role === 'store_manager') {
      query += ` AND s.id IN (
        SELECT store_id FROM user_store_assignments 
        WHERE user_id = $${paramIndex}
      )`;
      params.push(req.user.id);
      paramIndex++;
    }
    */
    
    query += `
      GROUP BY s.id, s.name, s.market_id, s.city, s.state, s.address, s.zip, s.phone, s.created_at, m.name
      ORDER BY m.name, s.name
    `;
    
    const result = await pool.query(query, params);
    
    // Format response to match what the component expects
    const stores = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip_code: row.zip_code || '',
      phone: row.phone || '',
      market_id: row.market_id,
      market_name: row.market_name,
      manager_name: row.manager_name,
      created_at: row.created_at
    }));
    
    res.json(stores);
    
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single store with detailed info
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    // Get store details with market info
    const storeResult = await pool.query(`
      SELECT 
        s.*,
        m.name as market_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', vt.id,
              'name', vt.name,
              'color', vt.color
            )
          ) FILTER (WHERE vt.id IS NOT NULL),
          '[]'
        ) as market_vendor_tags
      FROM stores s
      LEFT JOIN markets m ON s.market_id = m.id
      LEFT JOIN market_tags mt ON m.id = mt.market_id
      LEFT JOIN vendor_tags vt ON mt.tag_id = vt.id
      WHERE s.id = $1
      GROUP BY s.id, m.name
    `, [id]);
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    const store = storeResult.rows[0];
    
    // Get assigned users
    const usersResult = await pool.query(`
      SELECT 
        u.id as user_id,
        u.first_name as firstName,
        u.last_name as lastName,
        u.email,
        u.role,
        usa.created_at as assigned_at
      FROM user_store_assignments usa
      JOIN users u ON usa.user_id::integer = u.id
      WHERE usa.store_id = $1::text
      ORDER BY u.first_name, u.last_name
    `, [id]);
    
    store.assigned_users = usersResult.rows;
    
    res.json(store);
    
  } catch (error) {
    console.error('Error fetching store details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create new store
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const {
      name,
      address,
      city,
      state,
      zip_code,
      phone,
      market_id
    } = req.body;
    
    if (!name || !market_id) {
      return res.status(400).json({ message: 'Store name and market are required' });
    }
    
    // Verify market exists
    const marketCheck = await pool.query('SELECT id, name FROM markets WHERE id = $1', [market_id]);
    if (marketCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    const result = await pool.query(`
      INSERT INTO stores (name, address, city, state, zip, phone, market_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, address, city, state, zip_code, phone, market_id]);
    
    const newStore = result.rows[0];
    newStore.market_name = marketCheck.rows[0].name;
    newStore.zip_code = newStore.zip;
    newStore.manager_name = 'Not assigned';
    
    res.status(201).json(newStore);
    
  } catch (error) {
    console.error('Error creating store:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Store with this name already exists in this market' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// PUT update store
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      name,
      address,
      city,
      state,
      zip_code,
      phone,
      market_id
    } = req.body;
    
    // Verify market exists if changing market
    if (market_id) {
      const marketCheck = await pool.query('SELECT id FROM markets WHERE id = $1', [market_id]);
      if (marketCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Market not found' });
      }
    }
    
    const result = await pool.query(`
      UPDATE stores
      SET name = $2, address = $3, city = $4, state = $5, 
          zip = $6, phone = $7, market_id = $8
      WHERE id = $1
      RETURNING *
    `, [id, name, address, city, state, zip_code, phone, market_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    // Get market name
    const marketResult = await pool.query('SELECT name FROM markets WHERE id = $1', [market_id]);
    
    const updatedStore = result.rows[0];
    updatedStore.market_name = marketResult.rows[0]?.name || '';
    updatedStore.zip_code = updatedStore.zip;
    
    // Get store manager from user assignments
    const managerResult = await pool.query(`
      SELECT STRING_AGG(u.first_name || ' ' || u.last_name, ', ') as manager_name
      FROM user_store_assignments usa
      JOIN users u ON usa.user_id::integer = u.id
      WHERE usa.store_id = $1::text AND u.role = 'store_manager'
    `, [id]);
    
    updatedStore.manager_name = managerResult.rows[0]?.manager_name || 'Not assigned';
    
    res.json(updatedStore);
    
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE store
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    // Check if store has performance data or other dependencies
    const dependencyCheck = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM performance_data WHERE store_id = $1) as performance_count,
        (SELECT COUNT(*) FROM goals WHERE store_id = $1) as goals_count,
        (SELECT COUNT(*) FROM advisor_mappings WHERE store_id = $1) as advisor_count
    `, [id]);
    
    const deps = dependencyCheck.rows[0];
    if (parseInt(deps.performance_count) > 0 || parseInt(deps.goals_count) > 0 || parseInt(deps.advisor_count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete store with existing performance data, goals, or advisor mappings. Please remove those first.' 
      });
    }
    
    const result = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING id, name', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    res.json({ 
      message: 'Store deleted successfully',
      deleted: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST assign user to store
router.post('/:id/assign-user', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Verify store exists
    const storeCheck = await pool.query('SELECT id FROM stores WHERE id = $1', [id]);
    if (storeCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }
    
    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Assign user to store
    await pool.query(`
      INSERT INTO user_store_assignments (user_id, store_id)
      VALUES ($1::text, $2::text)
      ON CONFLICT (user_id, store_id) DO NOTHING
    `, [user_id, id]);
    
    res.json({ message: 'User assigned to store successfully' });
    
  } catch (error) {
    console.error('Error assigning user to store:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE unassign user from store
router.delete('/:id/unassign-user/:userId', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { id, userId } = req.params;
    
    const result = await pool.query(`
      DELETE FROM user_store_assignments 
      WHERE user_id = $1::text AND store_id = $2::text
      RETURNING *
    `, [userId, id]);
    
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