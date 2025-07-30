const express = require('express');
const router = express.Router();

// Get coaching messages for an advisor
router.get('/advisor/:advisorId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { advisorId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Check permissions
    if (req.user.role === 'advisor' && req.user.id !== parseInt(advisorId)) {
      return res.status(403).json({ message: 'You can only view your own coaching messages' });
    }
    
    // Check if user has permission to view this advisor's messages
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      const hasPermission = await checkCoachingPermission(req.user, advisorId, pool);
      if (!hasPermission) {
        return res.status(403).json({ message: 'You do not have permission to view these coaching messages' });
      }
    }
    
    // Get messages with author info
    const result = await pool.query(`
      SELECT 
        cm.id,
        cm.advisor_user_id as "advisorUserId",
        cm.author_user_id as "authorUserId",
        u.first_name || ' ' || u.last_name as "authorName",
        u.role as "authorRole",
        cm.message,
        cm.is_read as "isRead",
        cm.created_at as "createdAt"
      FROM coaching_messages cm
      JOIN users u ON cm.author_user_id = u.id
      WHERE cm.advisor_user_id = $1
      ORDER BY cm.created_at DESC
      LIMIT $2 OFFSET $3
    `, [advisorId, limit, offset]);
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM coaching_messages WHERE advisor_user_id = $1',
      [advisorId]
    );
    
    // Mark messages as read if the advisor is viewing their own messages
    if (req.user.role === 'advisor' && req.user.id === parseInt(advisorId)) {
      await pool.query(
        'UPDATE coaching_messages SET is_read = true WHERE advisor_user_id = $1 AND is_read = false',
        [advisorId]
      );
    }
    
    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error fetching coaching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a coaching message
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { advisorUserId, message } = req.body;
    const authorUserId = req.user.id;
    
    if (!advisorUserId || !message) {
      return res.status(400).json({ message: 'Advisor ID and message are required' });
    }
    
    // Check permissions
    if (req.user.role === 'advisor') {
      return res.status(403).json({ message: 'Advisors cannot create coaching messages' });
    }
    
    const hasPermission = await checkCoachingPermission(req.user, advisorUserId, pool);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to coach this advisor' });
    }
    
    // Create the message
    const result = await pool.query(`
      INSERT INTO coaching_messages (advisor_user_id, author_user_id, message)
      VALUES ($1, $2, $3)
      RETURNING 
        id,
        advisor_user_id as "advisorUserId",
        author_user_id as "authorUserId",
        message,
        is_read as "isRead",
        created_at as "createdAt"
    `, [advisorUserId, authorUserId, message]);
    
    // Get author info for response
    const authorResult = await pool.query(
      'SELECT first_name || \' \' || last_name as name, role FROM users WHERE id = $1',
      [authorUserId]
    );
    
    const newMessage = result.rows[0];
    newMessage.authorName = authorResult.rows[0].name;
    newMessage.authorRole = authorResult.rows[0].role;
    
    res.status(201).json(newMessage);
    
  } catch (error) {
    console.error('Error creating coaching message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count for an advisor
router.get('/advisor/:advisorId/unread-count', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { advisorId } = req.params;
    
    // Check permissions
    if (req.user.role === 'advisor' && req.user.id !== parseInt(advisorId)) {
      return res.status(403).json({ message: 'You can only view your own message count' });
    }
    
    const result = await pool.query(
      'SELECT COUNT(*) as "unreadCount" FROM coaching_messages WHERE advisor_user_id = $1 AND is_read = false',
      [advisorId]
    );
    
    res.json({ unreadCount: parseInt(result.rows[0].unreadCount) });
    
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get coaching summary for managers
router.get('/summary', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId, storeId, startDate, endDate } = req.query;
    
    if (req.user.role === 'advisor') {
      return res.status(403).json({ message: 'Advisors cannot view coaching summaries' });
    }
    
    let whereClause = '';
    const params = [];
    
    // Build where clause based on filters and permissions
    if (req.user.role === 'admin') {
      // Admin can see all
      if (marketId) {
        whereClause = 'WHERE am.market_id = $1';
        params.push(marketId);
      } else if (storeId) {
        whereClause = 'WHERE am.store_id = $1';
        params.push(storeId);
      }
    } else if (req.user.role === 'marketManager') {
      // Market manager can only see their markets
      whereClause = `WHERE am.market_id IN (
        SELECT market_id FROM user_markets WHERE user_id = $1
      )`;
      params.push(req.user.id);
      
      if (storeId) {
        whereClause += ' AND am.store_id = $' + (params.length + 1);
        params.push(storeId);
      }
    } else if (req.user.role === 'storeManager') {
      // Store manager can only see their stores
      whereClause = `WHERE am.store_id IN (
        SELECT store_id FROM user_stores WHERE user_id = $1
      )`;
      params.push(req.user.id);
    }
    
    // Add date filters if provided
    if (startDate && endDate) {
      const dateClause = whereClause ? ' AND' : ' WHERE';
      whereClause += `${dateClause} cm.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(startDate, endDate);
    }
    
    // Get coaching activity summary
    const result = await pool.query(`
      SELECT 
        u.id as "advisorId",
        u.first_name || ' ' || u.last_name as "advisorName",
        s.name as "storeName",
        m.name as "marketName",
        COUNT(cm.id) as "totalMessages",
        COUNT(CASE WHEN cm.is_read = false THEN 1 END) as "unreadMessages",
        MAX(cm.created_at) as "lastMessageDate",
        COUNT(DISTINCT cm.author_user_id) as "uniqueCoaches"
      FROM users u
      JOIN advisor_mappings am ON am.user_id = u.id
      LEFT JOIN stores s ON am.store_id = s.id
      LEFT JOIN markets m ON am.market_id = m.id
      LEFT JOIN coaching_messages cm ON cm.advisor_user_id = u.id
      ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, s.name, m.name
      ORDER BY "totalMessages" DESC
    `, params);
    
    res.json({
      advisors: result.rows,
      filters: { marketId, storeId, startDate, endDate }
    });
    
  } catch (error) {
    console.error('Error getting coaching summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to check coaching permissions
async function checkCoachingPermission(user, advisorUserId, pool) {
  switch (user.role) {
    case 'admin':
      return true;
      
    case 'marketManager':
      // Check if the advisor is in a market managed by this user
      const marketResult = await pool.query(`
        SELECT 1 
        FROM advisor_mappings am
        JOIN user_markets um ON um.market_id = am.market_id
        WHERE am.user_id = $1 AND um.user_id = $2
        LIMIT 1
      `, [advisorUserId, user.id]);
      return marketResult.rows.length > 0;
      
    case 'storeManager':
      // Check if the advisor is in a store managed by this user
      const storeResult = await pool.query(`
        SELECT 1 
        FROM advisor_mappings am
        JOIN user_stores us ON us.store_id = am.store_id
        WHERE am.user_id = $1 AND us.user_id = $2
        LIMIT 1
      `, [advisorUserId, user.id]);
      return storeResult.rows.length > 0;
      
    default:
      return false;
  }
}

module.exports = router;