const express = require('express');
const router = express.Router();

// =========================================
// MARKET MANAGEMENT ROUTES FOR PHASE 1
// =========================================

// GET /api/phase1/markets - Get all markets with vendor tags
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { vendor_tag, status } = req.query;
    
    // Check permissions and apply role-based filtering
    let query = `
      SELECT 
        m.id as market_id,
        m.name as market_name,
        COALESCE(m.vendor_tags, '{}') as vendor_tags,
        m.description,
        NULL as city,
        m.state,
        NULL as zip,
        NULL as contact_market_manager_id,
        m.created_at,
        -- Count stores in this market
        (SELECT COUNT(*) FROM stores WHERE market_id = m.id) as store_count,
        -- Get contact market manager details (placeholder since no contact manager field)
        NULL as contact_manager_first_name,
        NULL as contact_manager_last_name,
        NULL as contact_manager_email
      FROM markets m
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Filter by vendor tag if provided
    if (vendor_tag) {
      query += ` AND $${paramIndex} = ANY(COALESCE(vendor_tags, '{}'))`;
      params.push(vendor_tag);
      paramIndex++;
    }
    
    // Apply role-based access control
    if (req.user.role === 'vendor_partner') {
      query += ` AND $${paramIndex} = ANY(COALESCE(vendor_tags, '{}'))`;
      params.push(req.user.vendor);
      paramIndex++;
    } else if (req.user.role === 'market_manager') {
      query += ` AND id::text IN (SELECT market_id FROM user_market_assignments WHERE user_id = $${paramIndex})`;
      params.push(req.user.user_id);
      paramIndex++;
    } else if (req.user.role === 'store_manager') {
      query += ` AND id IN (
        SELECT DISTINCT s.market_id 
        FROM stores s 
        JOIN user_store_assignments usa ON usa.store_id = s.store_id 
        WHERE usa.user_id = $${paramIndex}
      )`;
      params.push(req.user.user_id);
      paramIndex++;
    }
    
    query += ` ORDER BY name`;
    
    const result = await pool.query(query, params);
    
    // Process the results to include contact manager details
    const markets = result.rows.map(row => ({
      market_id: row.market_id,
      market_name: row.market_name,
      vendor_tags: row.vendor_tags,
      description: row.description,
      city: row.city,
      state: row.state,
      zip: row.zip,
      contact_market_manager_id: row.contact_market_manager_id,
      store_count: row.store_count,
      created_at: row.created_at,
      contact_market_manager: row.contact_manager_first_name ? {
        first_name: row.contact_manager_first_name,
        last_name: row.contact_manager_last_name,
        email: row.contact_manager_email
      } : null
    }));
    
    res.json({
      markets,
      total: markets.length
    });
    
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/markets/:marketId - Get specific market
router.get('/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    
    // Check access permissions
    let accessQuery = 'SELECT 1 FROM markets WHERE id = $1';
    const accessParams = [marketId];
    
    if (req.user.role === 'vendor_partner') {
      accessQuery += ' AND $2 = ANY(COALESCE(vendor_tags, \'{}\'))';
      accessParams.push(req.user.vendor);
    } else if (req.user.role === 'market_manager') {
      accessQuery += ' AND id::text IN (SELECT market_id FROM user_market_assignments WHERE user_id = $2)';
      accessParams.push(req.user.user_id);
    } else if (req.user.role === 'store_manager') {
      accessQuery += ` AND id IN (
        SELECT DISTINCT s.market_id 
        FROM stores s 
        JOIN user_store_assignments usa ON usa.store_id = s.store_id 
        WHERE usa.user_id = $2
      )`;
      accessParams.push(req.user.user_id);
    } else if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const accessCheck = await pool.query(accessQuery, accessParams);
    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found or access denied' });
    }
    
    // Get market details
    const marketResult = await pool.query(`
      SELECT 
        m.id as market_id,
        m.name as market_name,
        COALESCE(m.vendor_tags, '{}') as vendor_tags,
        m.description,
        m.city,
        m.state,
        m.zip,
        m.contact_market_manager_id,
        m.created_at,
        u.first_name as contact_manager_first_name,
        u.last_name as contact_manager_last_name,
        u.email as contact_manager_email
      FROM markets m
      LEFT JOIN users u ON u.user_id = m.contact_market_manager_id
      WHERE m.id = $1
    `, [marketId]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    // Get stores in this market
    const storesResult = await pool.query(`
      SELECT 
        id as store_id,
        name as store_name,
        address,
        phone,
        'active' as status,
        created_at
      FROM stores 
      WHERE market_id = $1
      ORDER BY name
    `, [marketId]);
    
    // Get all market managers assigned to this market
    const marketManagersResult = await pool.query(`
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        uma.assigned_at
      FROM user_market_assignments uma
      JOIN users u ON u.user_id = uma.user_id
      WHERE uma.market_id = $1 AND u.role = 'market_manager'
      ORDER BY u.first_name, u.last_name
    `, [marketId]);
    
    // Get all users across all stores in this market
    const usersResult = await pool.query(`
      SELECT DISTINCT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        s.id as store_id,
        s.name as store_name
      FROM stores s
      JOIN user_store_assignments usa ON usa.store_id::integer = s.id
      JOIN users u ON u.user_id = usa.user_id
      WHERE s.market_id = $1
      ORDER BY s.name, u.first_name, u.last_name
    `, [marketId]);
    
    const market = marketResult.rows[0];
    market.stores = storesResult.rows;
    market.market_managers = marketManagersResult.rows;
    market.store_users = usersResult.rows;
    
    // Add contact manager details
    if (market.contact_market_manager_id && market.contact_manager_first_name) {
      market.contact_market_manager = {
        first_name: market.contact_manager_first_name,
        last_name: market.contact_manager_last_name,
        email: market.contact_manager_email
      };
    }
    
    // Clean up the flattened fields
    delete market.contact_manager_first_name;
    delete market.contact_manager_last_name;
    delete market.contact_manager_email;
    
    res.json(market);
    
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/markets - Create new market
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { market_id, market_name, vendor_tags, description, city, state, zip, contact_market_manager_id } = req.body;
    
    // Check permissions - only admin can create markets
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Validate required fields
    if (!market_name) {
      return res.status(400).json({ message: 'Market name is required' });
    }
    
    // Generate market_id if not provided
    const finalMarketId = market_id || Date.now().toString();
    
    const result = await pool.query(`
      INSERT INTO markets (name, vendor_tags, description, city, state, zip, contact_market_manager_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id as market_id, name as market_name, vendor_tags, description, city, state, zip, contact_market_manager_id, created_at
    `, [market_name, vendor_tags || [], description, city, state, zip, contact_market_manager_id || null]);
    
    res.status(201).json({
      message: 'Market created successfully',
      market: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating market:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Market with this ID already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// PUT /api/phase1/markets/:marketId - Update market
router.put('/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    const { market_name, vendor_tags, description, city, state, zip, contact_market_manager_id, market_managers } = req.body;
    
    // Check permissions - only admin can update markets
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (market_name) {
      updates.push(`name = $${paramIndex}`);
      params.push(market_name);
      paramIndex++;
    }
    
    if (vendor_tags !== undefined) {
      updates.push(`vendor_tags = $${paramIndex}`);
      params.push(vendor_tags);
      paramIndex++;
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    
    if (city !== undefined) {
      updates.push(`city = $${paramIndex}`);
      params.push(city);
      paramIndex++;
    }
    
    if (state !== undefined) {
      updates.push(`state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    
    if (zip !== undefined) {
      updates.push(`zip = $${paramIndex}`);
      params.push(zip);
      paramIndex++;
    }
    
    if (contact_market_manager_id !== undefined) {
      updates.push(`contact_market_manager_id = $${paramIndex}`);
      params.push(contact_market_manager_id || null);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    params.push(marketId);
    const updateQuery = `
      UPDATE markets 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id as market_id, name as market_name, vendor_tags, description, city, state, zip, contact_market_manager_id
    `;
    
    const result = await pool.query(updateQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    // Handle market managers update if provided
    if (market_managers !== undefined && Array.isArray(market_managers)) {
      // Start transaction for market managers update
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Remove all existing market manager assignments for this market
        await client.query(
          'DELETE FROM user_market_assignments WHERE market_id = $1',
          [marketId]
        );
        
        // Add new market manager assignments
        for (const managerId of market_managers) {
          await client.query(
            'INSERT INTO user_market_assignments (user_id, market_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [managerId, marketId]
          );
        }
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    
    res.json({
      message: 'Market updated successfully',
      market: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/phase1/markets/:marketId - Delete market
router.delete('/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    
    // Check permissions - only admin can delete markets
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if market has stores
    const storeCheck = await pool.query('SELECT COUNT(*) as count FROM stores WHERE market_id = $1', [marketId]);
    if (parseInt(storeCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete market with existing stores' });
    }
    
    const result = await pool.query('DELETE FROM markets WHERE id = $1 RETURNING id', [marketId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    res.json({ message: 'Market deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/markets/:marketId/vendor-tags - Get available vendor tags
router.get('/:marketId/vendor-tags', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Get all available vendor tags from reference table
    const result = await pool.query(`
      SELECT vendor_code, vendor_name, description
      FROM vendor_tags_reference 
      WHERE status = 'active'
      ORDER BY vendor_name
    `);
    
    res.json({
      vendor_tags: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching vendor tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/markets/:marketId/assign-user - Assign user to market
router.post('/:marketId/assign-user', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    const { user_id } = req.body;
    
    // Check permissions - only admin can assign users
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Verify market exists
    const marketCheck = await pool.query('SELECT id FROM markets WHERE id = $1', [marketId]);
    if (marketCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    // Verify user exists
    const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Assign user to market
    await pool.query(`
      INSERT INTO user_market_assignments (user_id, market_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, market_id) DO NOTHING
    `, [user_id, marketId]);
    
    res.json({ message: 'User assigned to market successfully' });
    
  } catch (error) {
    console.error('Error assigning user to market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/phase1/markets/:marketId/unassign-user/:userId - Remove user from market
router.delete('/:marketId/unassign-user/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId, userId } = req.params;
    
    // Check permissions - only admin can unassign users
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      DELETE FROM user_market_assignments 
      WHERE user_id = $1 AND market_id = $2
      RETURNING id
    `, [userId, marketId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    res.json({ message: 'User unassigned from market successfully' });
    
  } catch (error) {
    console.error('Error unassigning user from market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;