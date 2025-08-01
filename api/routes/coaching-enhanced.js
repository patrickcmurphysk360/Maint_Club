const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/messages');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Helper function to determine file type
function getFileType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.includes('pdf') || mimetype.includes('document') || 
      mimetype.includes('spreadsheet') || mimetype.includes('text')) return 'document';
  return 'other';
}

// Helper function to check coaching permissions
async function checkCoachingPermission(user, advisorId, pool) {
  if (user.role === 'admin' || user.role === 'administrator') return true;
  
  if (user.role === 'advisor') {
    // Get the correct user_id from database
    const userResult = await pool.query('SELECT user_id FROM users WHERE id = $1', [user.id]);
    if (userResult.rows.length === 0) return false;
    const userIdStr = userResult.rows[0].user_id;
    return userIdStr === advisorId.toString();
  }
  
  if (user.role === 'marketManager' || user.role === 'storeManager' || user.role === 'market_manager' || user.role === 'store_manager') {
    const userIdNum = user.id; // user_store_assignments uses integer user IDs
    const advisorIdNum = parseInt(advisorId); // Convert advisor ID to integer for user_store_assignments
    const result = await pool.query(`
      SELECT 1 FROM user_store_assignments us 
      JOIN user_store_assignments advisor_stores ON advisor_stores.store_id = us.store_id
      WHERE us.user_id = $1 AND advisor_stores.user_id = $2
    `, [userIdNum, advisorIdNum]);
    return result.rows.length > 0;
  }
  
  return false;
}

// GET /api/coaching/threads - Get all message threads
router.get('/threads', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        mt.id as "threadId",
        mt.advisor_user_id as "advisorUserId",
        ua.first_name || ' ' || ua.last_name as "advisorName",
        ua.email as "advisorEmail",
        mt.subject,
        mt.last_message_at as "lastMessageAt",
        mt.message_count as "messageCount",
        mt.is_archived as "isArchived",
        COALESCE(cm_last.message, '') as "lastMessage",
        u_author.first_name || ' ' || u_author.last_name as "lastMessageAuthor",
        COALESCE(unread.count, 0) as "unreadCount",
        COALESCE(attachments.has_files, false) as "hasAttachments"
      FROM message_threads mt
      JOIN users ua ON ua.id = mt.advisor_user_id
      LEFT JOIN coaching_messages cm_last ON cm_last.thread_id = mt.id 
        AND cm_last.created_at = mt.last_message_at
      LEFT JOIN users u_author ON u_author.id = cm_last.author_user_id
      LEFT JOIN (
        SELECT thread_id, COUNT(*) as count
        FROM coaching_messages 
        WHERE is_read = false AND author_user_id != $1
        GROUP BY thread_id
      ) unread ON unread.thread_id = mt.id
      LEFT JOIN (
        SELECT DISTINCT cm.thread_id, true as has_files
        FROM coaching_messages cm
        JOIN message_attachments ma ON ma.message_id = cm.id
      ) attachments ON attachments.thread_id = mt.id
    `;
    
    // Get the correct user_id from database
    const currentUserResult = await pool.query('SELECT user_id FROM users WHERE id = $1', [req.user.id]);
    const userIdStr = currentUserResult.rows.length > 0 ? currentUserResult.rows[0].user_id : req.user.id.toString();
    const params = [userIdStr];
    
    // Filter based on user role
    if (req.user.role === 'advisor') {
      query += ` WHERE mt.advisor_user_id = $2`;
      params.push(userIdStr);
    } else if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      // For managers, we need to find advisors in their stores
      // But advisor_user_id in message_threads is a string, and user_store_assignments uses integers
      query += ` WHERE mt.advisor_user_id IN (
        SELECT u.user_id FROM users u
        JOIN user_store_assignments usa ON usa.user_id = u.id
        WHERE usa.store_id IN (
          SELECT store_id FROM user_store_assignments WHERE user_id = $2
        )
      )`;
      params.push(req.user.id);
    }
    
    query += ` ORDER BY mt.last_message_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      threads: result.rows,
      total: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching message threads:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coaching/threads/:threadId/messages - Get messages in a thread
router.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { threadId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Verify user has access to this thread
    const threadCheck = await pool.query(`
      SELECT advisor_user_id FROM message_threads WHERE id = $1
    `, [threadId]);
    
    if (threadCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    const advisorId = threadCheck.rows[0].advisor_user_id;
    const hasPermission = await checkCoachingPermission(req.user, advisorId, pool);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get messages with attachments
    const result = await pool.query(`
      SELECT 
        cm.id,
        cm.thread_id as "threadId",
        cm.parent_message_id as "parentMessageId",
        cm.author_user_id as "authorUserId",
        u.first_name || ' ' || u.last_name as "authorName",
        u.role as "authorRole",
        cm.message,
        cm.message_type as "messageType",
        cm.is_read as "isRead",
        cm.created_at as "createdAt",
        cm.edited_at as "editedAt",
        cm.reactions,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ma.id,
              'originalFilename', ma.original_filename,
              'storedFilename', ma.stored_filename,
              'filePath', ma.file_path,
              'fileSize', ma.file_size,
              'mimeType', ma.mime_type,
              'fileType', ma.file_type,
              'thumbnailPath', ma.thumbnail_path
            ) ORDER BY ma.created_at
          ) FILTER (WHERE ma.id IS NOT NULL),
          '[]'
        ) as attachments
      FROM coaching_messages cm
      JOIN users u ON cm.author_user_id = u.id
      LEFT JOIN message_attachments ma ON ma.message_id = cm.id
      WHERE cm.thread_id = $1
      GROUP BY cm.id, u.id
      ORDER BY cm.created_at ASC
      LIMIT $2 OFFSET $3
    `, [threadId, limit, offset]);
    
    // Mark messages as read for the current user
    if (req.user.role === 'advisor' && req.user.id === advisorId) {
      await pool.query(`
        UPDATE coaching_messages 
        SET is_read = true 
        WHERE thread_id = $1 AND author_user_id != $2 AND is_read = false
      `, [threadId, req.user.id]);
    }
    
    res.json({
      messages: result.rows,
      threadId: parseInt(threadId),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/coaching/threads/:threadId/messages - Send a message in a thread
router.post('/threads/:threadId/messages', upload.single('attachment'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { threadId } = req.params;
    const { message, parentMessageId } = req.body;
    
    // Get the correct user_id from database since JWT might have wrong format
    const currentUserResult = await pool.query('SELECT user_id FROM users WHERE id = $1', [req.user.id]);
    if (currentUserResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    const userId = currentUserResult.rows[0].user_id;
    
    // Verify thread exists and user has access
    const threadCheck = await pool.query(`
      SELECT advisor_user_id FROM message_threads WHERE id = $1
    `, [threadId]);
    
    if (threadCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    const advisorId = threadCheck.rows[0].advisor_user_id;
    const hasPermission = await checkCoachingPermission(req.user, advisorId, pool);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Determine message type
    let messageType = 'text';
    if (req.file) {
      messageType = getFileType(req.file.mimetype);
    }
    
    // Insert message
    const messageResult = await pool.query(`
      INSERT INTO coaching_messages 
      (thread_id, advisor_user_id, author_user_id, message, message_type, parent_message_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [threadId, advisorId, userId, message || '', messageType, parentMessageId || null]);
    
    const messageId = messageResult.rows[0].id;
    
    // Handle file attachment if present
    let attachment = null;
    if (req.file) {
      const attachmentResult = await pool.query(`
        INSERT INTO message_attachments 
        (message_id, original_filename, stored_filename, file_path, file_size, mime_type, file_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, original_filename, file_size, mime_type, file_type
      `, [
        messageId,
        req.file.originalname,
        req.file.filename,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        getFileType(req.file.mimetype),
        req.user.id // message_attachments uses integer user ID for uploaded_by
      ]);
      
      attachment = attachmentResult.rows[0];
    }
    
    // Update thread metadata (this will be handled by trigger, but we can also do it manually)
    await pool.query(`
      UPDATE message_threads 
      SET last_message_at = $1, message_count = message_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [messageResult.rows[0].created_at, threadId]);
    
    // Get the complete message with author info for response
    const fullMessage = await pool.query(`
      SELECT 
        cm.id,
        cm.thread_id as "threadId",
        cm.parent_message_id as "parentMessageId",
        cm.author_user_id as "authorUserId",
        u.first_name || ' ' || u.last_name as "authorName",
        u.role as "authorRole",
        cm.message,
        cm.message_type as "messageType",
        cm.is_read as "isRead",
        cm.created_at as "createdAt"
      FROM coaching_messages cm
      JOIN users u ON cm.author_user_id = u.id
      WHERE cm.id = $1
    `, [messageId]);
    
    res.status(201).json({
      ...fullMessage.rows[0],
      attachment
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/coaching/threads - Create a new thread
router.post('/threads', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { advisorUserId, subject, message } = req.body;
    
    // Get the correct user_id from database since JWT might have wrong format
    const currentUserResult = await pool.query('SELECT user_id FROM users WHERE id = $1', [req.user.id]);
    if (currentUserResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    const userId = currentUserResult.rows[0].user_id;
    
    if (!advisorUserId || !message) {
      return res.status(400).json({ message: 'Advisor ID and message are required' });
    }
    
    console.log('Creating thread - advisorUserId:', advisorUserId, 'userId:', userId, 'subject:', subject);
    
    // Convert advisor integer ID to user_id string if needed
    let advisorUserIdStr = advisorUserId;
    if (typeof advisorUserId === 'number' || /^\d+$/.test(advisorUserId)) {
      const userResult = await pool.query('SELECT user_id FROM users WHERE id = $1', [advisorUserId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'Advisor not found' });
      }
      advisorUserIdStr = userResult.rows[0].user_id;
    }
    console.log('Converted advisorUserId to:', advisorUserIdStr);
    
    // Verify user has permission to message this advisor
    const hasPermission = await checkCoachingPermission(req.user, advisorUserIdStr, pool);
    console.log('Permission check result:', hasPermission, 'for user role:', req.user.role);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Create thread
    const threadResult = await pool.query(`
      INSERT INTO message_threads (advisor_user_id, created_by, subject, message_count)
      VALUES ($1, $2, $3, 1)
      RETURNING id, created_at
    `, [advisorUserIdStr, userId, subject || 'New Coaching Thread']);
    
    const threadId = threadResult.rows[0].id;
    
    // Create first message
    await pool.query(`
      INSERT INTO coaching_messages 
      (thread_id, advisor_user_id, author_user_id, message)
      VALUES ($1, $2, $3, $4)
    `, [threadId, advisorUserIdStr, userId, message]);
    
    res.status(201).json({
      threadId,
      advisorUserId: parseInt(advisorUserId),
      subject: subject || 'New Coaching Thread',
      createdAt: threadResult.rows[0].created_at
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    console.error('Request body:', req.body);
    console.error('User:', req.user);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/coaching/attachments/:attachmentId - Download attachment
router.get('/attachments/:attachmentId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { attachmentId } = req.params;
    
    // Get attachment info and verify permissions
    const result = await pool.query(`
      SELECT 
        ma.original_filename,
        ma.stored_filename,
        ma.file_path,
        ma.mime_type,
        ma.file_type,
        mt.advisor_user_id
      FROM message_attachments ma
      JOIN coaching_messages cm ON cm.id = ma.message_id
      JOIN message_threads mt ON mt.id = cm.thread_id
      WHERE ma.id = $1
    `, [attachmentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    const attachment = result.rows[0];
    const hasPermission = await checkCoachingPermission(req.user, attachment.advisor_user_id, pool);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    
    // Stream the file
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/coaching/attachments/:attachmentId/view - View attachment inline (for images)
router.get('/attachments/:attachmentId/view', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { attachmentId } = req.params;
    
    // Get attachment info and verify permissions
    const result = await pool.query(`
      SELECT 
        ma.original_filename,
        ma.file_path,
        ma.mime_type,
        ma.file_type,
        mt.advisor_user_id
      FROM message_attachments ma
      JOIN coaching_messages cm ON cm.id = ma.message_id
      JOIN message_threads mt ON mt.id = cm.thread_id
      WHERE ma.id = $1 AND ma.file_type = 'image'
    `, [attachmentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    const attachment = result.rows[0];
    const hasPermission = await checkCoachingPermission(req.user, attachment.advisor_user_id, pool);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Set headers for inline viewing
    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    // Stream the file
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error viewing attachment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;