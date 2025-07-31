const express = require('express');
const router = express.Router();

// GET /api/advisor-mappings - Get all advisor mappings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const query = `
      SELECT 
        am.id,
        am.spreadsheet_name as advisor_name,
        am.user_id,
        am.created_at,
        am.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.status as user_status
      FROM advisor_mappings am
      LEFT JOIN users u ON am.user_id::text = u.id::text
      ORDER BY am.spreadsheet_name
    `;
    
    const result = await pool.query(query);
    
    const mappings = result.rows.map(row => ({
      id: row.id,
      advisor_name: row.advisor_name,
      user_id: row.user_id,
      user_name: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      user_email: row.email,
      user_status: row.user_status,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    res.json(mappings);
  } catch (error) {
    console.error('Error fetching advisor mappings:', error);
    res.status(500).json({ error: 'Failed to fetch advisor mappings' });
  }
});

// POST /api/advisor-mappings - Create or update advisor mapping
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { advisor_name, user_id } = req.body;
    
    if (!advisor_name || !user_id) {
      return res.status(400).json({ 
        error: 'Advisor name and user ID are required' 
      });
    }
    
    // Check if mapping already exists for this advisor
    const existingQuery = `
      SELECT id FROM advisor_mappings WHERE spreadsheet_name = $1
    `;
    const existingResult = await pool.query(existingQuery, [advisor_name]);
    
    let result;
    if (existingResult.rows.length > 0) {
      // Update existing mapping
      const updateQuery = `
        UPDATE advisor_mappings 
        SET user_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE spreadsheet_name = $1
        RETURNING *
      `;
      result = await pool.query(updateQuery, [advisor_name, user_id]);
    } else {
      // Create new mapping
      const insertQuery = `
        INSERT INTO advisor_mappings (spreadsheet_name, user_id, is_active)
        VALUES ($1, $2, true)
        RETURNING *
      `;
      result = await pool.query(insertQuery, [advisor_name, user_id]);
    }
    
    res.status(201).json({
      id: result.rows[0].id,
      advisor_name: result.rows[0].spreadsheet_name,
      user_id: result.rows[0].user_id,
      message: 'Advisor mapping saved successfully'
    });
    
  } catch (error) {
    console.error('Error creating advisor mapping:', error);
    
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ 
        error: 'Invalid user ID - user does not exist' 
      });
    }
    
    res.status(500).json({ error: 'Failed to create advisor mapping' });
  }
});

// DELETE /api/advisor-mappings/:id - Delete advisor mapping
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { id } = req.params;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(
      'DELETE FROM advisor_mappings WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Advisor mapping not found' });
    }
    
    res.json({ message: 'Advisor mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting advisor mapping:', error);
    res.status(500).json({ error: 'Failed to delete advisor mapping' });
  }
});

// GET /api/advisor-mappings/by-name/:name - Get mapping for specific advisor name
router.get('/by-name/:name', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { name } = req.params;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'storeManager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const query = `
      SELECT 
        am.id,
        am.spreadsheet_name as advisor_name,
        am.user_id,
        am.created_at,
        am.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.status as user_status
      FROM advisor_mappings am
      LEFT JOIN users u ON am.user_id::text = u.id::text
      WHERE am.spreadsheet_name = $1
    `;
    
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Advisor mapping not found' });
    }
    
    const row = result.rows[0];
    const mapping = {
      id: row.id,
      advisor_name: row.advisor_name,
      user_id: row.user_id,
      user_name: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      user_email: row.email,
      user_status: row.user_status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
    res.json(mapping);
  } catch (error) {
    console.error('Error fetching advisor mapping:', error);
    res.status(500).json({ error: 'Failed to fetch advisor mapping' });
  }
});

module.exports = router;