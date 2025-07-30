const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all markets with store counts and vendor tags
router.get('/', async (req, res) => {
  try {
    const { vendor_tag } = req.query;
    
    let query = `
      SELECT 
        m.*,
        COALESCE(store_counts.store_count, 0) as store_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', vt.id,
              'name', vt.name,
              'color', vt.color
            )
          ) FILTER (WHERE vt.id IS NOT NULL), 
          '[]'
        ) as vendor_tag_details
      FROM markets m
      LEFT JOIN (
        SELECT market_id, COUNT(*) as store_count
        FROM stores
        GROUP BY market_id
      ) store_counts ON m.id = store_counts.market_id
      LEFT JOIN market_tags mt ON m.id = mt.market_id
      LEFT JOIN vendor_tags vt ON mt.tag_id = vt.id
    `;
    
    const params = [];
    
    if (vendor_tag) {
      query += ` WHERE EXISTS (
        SELECT 1 FROM market_tags mt2 
        JOIN vendor_tags vt2 ON mt2.tag_id = vt2.id
        WHERE mt2.market_id = m.id AND vt2.id = $1
      )`;
      params.push(vendor_tag);
    }
    
    query += `
      GROUP BY m.id, store_counts.store_count
      ORDER BY m.name
    `;
    
    const result = await pool.query(query, params);
    
    // Format the response to match expected structure
    const markets = result.rows.map(row => ({
      market_id: row.id.toString(),
      id: row.id,
      market_name: row.name,
      name: row.name,
      description: row.description,
      city: row.city,
      state: row.state,
      zip: row.zip,
      vendor_tags: row.vendor_tag_details.map(vt => vt.id),
      vendor_tag_details: row.vendor_tag_details,
      store_count: parseInt(row.store_count),
      contact_market_manager_id: row.contact_market_manager_id,
      created_at: row.created_at
    }));
    
    res.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single market with detailed info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get market details
    const marketResult = await pool.query(`
      SELECT 
        m.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', vt.id,
              'name', vt.name,
              'color', vt.color
            )
          ) FILTER (WHERE vt.id IS NOT NULL), 
          '[]'
        ) as vendor_tag_details
      FROM markets m
      LEFT JOIN market_tags mt ON m.id = mt.market_id
      LEFT JOIN vendor_tags vt ON mt.tag_id = vt.id
      WHERE m.id = $1
      GROUP BY m.id
    `, [id]);
    
    if (marketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    const market = marketResult.rows[0];
    
    // Get stores for this market
    const storesResult = await pool.query(`
      SELECT 
        s.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', u.id,
              'user_id', u.id,
              'firstName', u.first_name,
              'lastName', u.last_name, 
              'email', u.email,
              'role', u.role
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as users
      FROM stores s
      LEFT JOIN user_store_assignments usa ON s.id::text = usa.store_id
      LEFT JOIN users u ON usa.user_id::integer = u.id
      WHERE s.market_id = $1
      GROUP BY s.id
      ORDER BY s.name
    `, [id]);
    
    const stores = storesResult.rows.map(store => ({
      store_id: store.id.toString(),
      store_name: store.name,
      city: store.city,
      state: store.state,
      users: store.users
    }));

    const response = {
      ...market,
      market_id: market.id.toString(),
      market_name: market.name,
      vendor_tags: market.vendor_tag_details.map(vt => vt.id),
      stores: stores
    };
    
    console.log(`Market ${id} response:`, {
      stores_count: stores.length,
      first_store: stores[0],
      users_in_first_store: stores[0]?.users?.length || 0
    });
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching market details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// CREATE new market
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const {
      market_name,
      description,
      city,
      state,
      zip,
      contact_market_manager_id,
      vendor_tags = []
    } = req.body;
    
    if (!market_name) {
      return res.status(400).json({ message: 'Market name is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert market
      const marketResult = await client.query(`
        INSERT INTO markets (name, description, city, state, zip, contact_market_manager_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [market_name, description, city, state, zip, contact_market_manager_id]);
      
      const market = marketResult.rows[0];
      
      // Insert vendor tags
      if (vendor_tags.length > 0) {
        for (const tagId of vendor_tags) {
          await client.query(`
            INSERT INTO market_tags (market_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT (market_id, tag_id) DO NOTHING
          `, [market.id, tagId]);
        }
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        market_id: market.id.toString(),
        market_name: market.name,
        ...market
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE market
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { id } = req.params;
    const {
      market_name,
      description,
      city,
      state,
      zip,
      contact_market_manager_id,
      vendor_tags = []
    } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update market
      const marketResult = await client.query(`
        UPDATE markets
        SET name = $2, description = $3, city = $4, state = $5, 
            zip = $6, contact_market_manager_id = $7
        WHERE id = $1
        RETURNING *
      `, [id, market_name, description, city, state, zip, contact_market_manager_id]);
      
      if (marketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Market not found' });
      }
      
      // Update vendor tags - remove all and re-add
      await client.query('DELETE FROM market_tags WHERE market_id = $1', [id]);
      
      if (vendor_tags.length > 0) {
        for (const tagId of vendor_tags) {
          await client.query(`
            INSERT INTO market_tags (market_id, tag_id)
            VALUES ($1, $2)
          `, [id, tagId]);
        }
      }
      
      await client.query('COMMIT');
      
      const market = marketResult.rows[0];
      res.json({
        market_id: market.id.toString(),
        market_name: market.name,
        ...market
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE market
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { id } = req.params;
    
    // Check if market has stores
    const storeCheck = await pool.query(
      'SELECT COUNT(*) FROM stores WHERE market_id = $1',
      [id]
    );
    
    if (parseInt(storeCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete market with existing stores. Please remove stores first.' 
      });
    }
    
    const result = await pool.query(
      'DELETE FROM markets WHERE id = $1 RETURNING id, name',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Market not found' });
    }
    
    res.json({ 
      message: 'Market deleted successfully',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting market:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;