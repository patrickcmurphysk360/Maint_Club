const express = require('express');
const router = express.Router();

// =========================================
// ADVISOR MAPPING ROUTES FOR PHASE 1
// =========================================

// GET /api/phase1/advisor-mappings - Get all advisor mappings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { market_id, store_name, unmapped_only } = req.query;
    
    // Check permissions - only admin and managers can view mappings
    if (!['admin', 'market_manager', 'store_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
      SELECT 
        am.id,
        am.employee_name,
        am.market_id,
        m.name as market_name,
        am.store_name,
        am.user_id,
        u.name as mapped_user_name,
        u.email as mapped_user_email,
        u.role as mapped_user_role,
        am.created_at,
        am.updated_at
      FROM advisor_mappings am
      LEFT JOIN markets m ON m.id::text = am.market_id
      LEFT JOIN users u ON u.user_id = am.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (market_id) {
      query += ` AND am.market_id = $${paramIndex}`;
      params.push(market_id);
      paramIndex++;
    }
    
    if (store_name) {
      query += ` AND am.store_name ILIKE $${paramIndex}`;
      params.push(`%${store_name}%`);
      paramIndex++;
    }
    
    if (unmapped_only === 'true') {
      query += ` AND am.user_id IS NULL`;
    }
    
    // Apply role-based access control
    if (req.user.role === 'market_manager') {
      query += ` AND am.market_id::text IN (SELECT market_id FROM user_market_assignments WHERE user_id = $${paramIndex})`;
      params.push(req.user.user_id);
      paramIndex++;
    } else if (req.user.role === 'store_manager') {
      query += ` AND am.store_name IN (
        SELECT s.name FROM stores s 
        JOIN user_store_assignments usa ON usa.store_id = s.store_id 
        WHERE usa.user_id = $${paramIndex}
      )`;
      params.push(req.user.user_id);
      paramIndex++;
    }
    
    query += ` ORDER BY am.market_id, am.store_name, am.employee_name`;
    
    const result = await pool.query(query, params);
    
    res.json({
      mappings: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching advisor mappings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/advisor-mappings/unmapped - Get unmapped advisor names from recent uploads
router.get('/unmapped', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can view unmapped names
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // This would typically come from parsing uploaded files
    // For now, we'll return any mappings without user_id
    const result = await pool.query(`
      SELECT 
        am.employee_name,
        am.market_id,
        m.name as market_name,
        am.store_name,
        COUNT(*) as occurrence_count
      FROM advisor_mappings am
      LEFT JOIN markets m ON m.id::text = am.market_id
      WHERE am.user_id IS NULL
      GROUP BY am.employee_name, am.market_id, m.name, am.store_name
      ORDER BY am.market_id, am.store_name, am.employee_name
    `);
    
    res.json({
      unmapped_names: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching unmapped advisor names:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/advisor-mappings/parse-file - Parse uploaded file to extract advisor names
router.post('/parse-file', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { file_data, market_id, file_type } = req.body;
    
    // Check permissions - only admin can parse files
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!file_data || !market_id) {
      return res.status(400).json({ message: 'File data and market ID are required' });
    }
    
    // This is a simplified version - in reality, you'd parse actual Excel data
    // For demo purposes, we'll simulate finding advisor names
    const simulatedAdvisorNames = [
      { employee_name: 'JOHN BLACKERBY', store_name: 'Mcdonough' },
      { employee_name: 'JANE SMITH', store_name: 'Atlanta Downtown' },
      { employee_name: 'MIKE JOHNSON', store_name: 'Mcdonough' }
    ];
    
    const newMappings = [];
    const existingMappings = [];
    
    for (const advisor of simulatedAdvisorNames) {
      // Check if mapping already exists
      const existingMapping = await pool.query(`
        SELECT id, user_id FROM advisor_mappings 
        WHERE employee_name = $1 AND market_id = $2 AND store_name = $3
      `, [advisor.employee_name, market_id, advisor.store_name]);
      
      if (existingMapping.rows.length > 0) {
        existingMappings.push({
          ...advisor,
          mapping_id: existingMapping.rows[0].id,
          is_mapped: existingMapping.rows[0].user_id !== null
        });
      } else {
        // Create new mapping
        const newMapping = await pool.query(`
          INSERT INTO advisor_mappings (employee_name, market_id, store_name)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [advisor.employee_name, market_id, advisor.store_name]);
        
        newMappings.push({
          ...advisor,
          mapping_id: newMapping.rows[0].id,
          is_mapped: false
        });
      }
    }
    
    res.json({
      message: 'File parsed successfully',
      new_mappings: newMappings,
      existing_mappings: existingMappings,
      summary: {
        total_advisors: simulatedAdvisorNames.length,
        new_mappings: newMappings.length,
        existing_mappings: existingMappings.length
      }
    });
    
  } catch (error) {
    console.error('Error parsing file for advisor mappings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/advisor-mappings/:mappingId/assign-user - Assign existing user to mapping
router.post('/:mappingId/assign-user', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { mappingId } = req.params;
    const { user_id } = req.body;
    
    // Check permissions - only admin can assign users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Verify mapping exists
    const mappingCheck = await pool.query('SELECT * FROM advisor_mappings WHERE id = $1', [mappingId]);
    if (mappingCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    // Verify user exists and is advisor role
    const userCheck = await pool.query('SELECT user_id, name, role FROM users WHERE user_id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update mapping
    const result = await pool.query(`
      UPDATE advisor_mappings 
      SET user_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [user_id, mappingId]);
    
    res.json({
      message: 'User assigned to mapping successfully',
      mapping: result.rows[0],
      assigned_user: userCheck.rows[0]
    });
    
  } catch (error) {
    console.error('Error assigning user to mapping:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/phase1/advisor-mappings/:mappingId/create-user - Create new user and assign to mapping
router.post('/:mappingId/create-user', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { mappingId } = req.params;
    const { name, email, password } = req.body;
    
    // Check permissions - only admin can create users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    
    // Verify mapping exists
    const mappingCheck = await pool.query('SELECT * FROM advisor_mappings WHERE id = $1', [mappingId]);
    if (mappingCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate user_id
      const user_id = `advisor_${Date.now()}`;
      
      // Hash password
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const userResult = await client.query(`
        INSERT INTO users (user_id, name, email, password, role, status)
        VALUES ($1, $2, $3, $4, 'advisor', 'active')
        RETURNING user_id, name, email, role, status, created_at
      `, [user_id, name, email, hashedPassword]);
      
      // Update mapping
      const mappingResult = await client.query(`
        UPDATE advisor_mappings 
        SET user_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [user_id, mappingId]);
      
      await client.query('COMMIT');
      
      res.status(201).json({
        message: 'User created and assigned to mapping successfully',
        user: userResult.rows[0],
        mapping: mappingResult.rows[0]
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating user for mapping:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'User with this email already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// DELETE /api/phase1/advisor-mappings/:mappingId/unassign-user - Remove user from mapping
router.delete('/:mappingId/unassign-user', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { mappingId } = req.params;
    
    // Check permissions - only admin can unassign users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      UPDATE advisor_mappings 
      SET user_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [mappingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    res.json({
      message: 'User unassigned from mapping successfully',
      mapping: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error unassigning user from mapping:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/advisor-mappings/available-users - Get users available for mapping
router.get('/available-users', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role = 'advisor' } = req.query;
    
    // Check permissions - only admin can view available users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        user_id,
        name,
        email,
        role,
        status,
        created_at
      FROM users 
      WHERE role = $1 AND status = 'active'
      ORDER BY name
    `, [role]);
    
    res.json({
      users: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/phase1/advisor-mappings/:mappingId - Delete mapping entirely
router.delete('/:mappingId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { mappingId } = req.params;
    
    // Check permissions - only admin can delete mappings
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query('DELETE FROM advisor_mappings WHERE id = $1 RETURNING *', [mappingId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    res.json({ message: 'Mapping deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;