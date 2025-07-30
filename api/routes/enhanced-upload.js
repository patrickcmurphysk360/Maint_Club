const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const UploadProcessor = require('../services/uploadProcessor');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Enhanced Services Upload - Step 1: Parse and discover
router.post('/upload/services/discover', upload.single('file'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const processor = new UploadProcessor(pool);
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { reportDate } = req.body;
    if (!reportDate) {
      return res.status(400).json({ message: 'Report date is required' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    const filePath = req.file.path;
    
    try {
      // Process the file and discover entities
      const result = await processor.processServicesFile(
        filePath, 
        req.file.originalname, 
        reportDate, 
        req.user.id
      );

      // Get existing data for intelligent matching
      const existingMarkets = await pool.query('SELECT id, name FROM markets ORDER BY name');
      const existingStores = await pool.query('SELECT id, name, market_id FROM stores ORDER BY name');
      const existingUsers = await pool.query(
        'SELECT id, first_name, last_name, email FROM users WHERE role = \'advisor\' ORDER BY first_name, last_name'
      );

      // Apply intelligent matching to discovered entities
      console.log('🔍 Discovered markets from spreadsheet:', result.discovered.markets.map(m => m.name));
      console.log('📋 Existing markets in database:', existingMarkets.rows.map(m => `${m.id}: ${m.name}`));
      
      const enhancedDiscovered = {
        markets: result.discovered.markets.map(market => {
          // Try exact match first
          let existing = existingMarkets.rows.find(m => 
            m.name.toLowerCase() === market.name.toLowerCase()
          );
          
          // If no exact match, try fuzzy matching using store matching logic (adapted for markets)
          if (!existing) {
            const match = processor.findBestStoreMatch(market.name, existingMarkets.rows.map(m => ({name: m.name, id: m.id})));
            existing = match?.store;
          }
          
          return {
            ...market,
            suggestedMatch: existing,
            action: existing ? 'map' : 'create',
            existing_id: existing?.id,
            proposed_id: result.fileInfo.marketId // Use market ID from filename
          };
        }),
        
        stores: result.discovered.stores.map(store => {
          const match = processor.findBestStoreMatch(store.name, existingStores.rows);
          return {
            ...store,
            suggestedMatch: match?.store,
            matchScore: match?.score,
            action: match && match.score > 0.8 ? 'map' : 'create',
            existing_id: match?.store?.id
          };
        }),
        
        advisors: result.discovered.advisors.map(advisor => {
          const match = processor.findBestAdvisorMatch(advisor.name, existingUsers.rows);
          return {
            ...advisor,
            suggestedMatch: match?.user,
            matchScore: match?.score,
            action: match && match.score > 0.8 ? 'map_user' : 'create_user',
            existing_user_id: match?.user?.id
          };
        })
      };

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({
        message: 'Services file parsed successfully',
        sessionId: result.sessionId,
        fileInfo: result.fileInfo,
        discovered: enhancedDiscovered,
        summary: {
          ...result.summary,
          autoMatched: {
            markets: enhancedDiscovered.markets.filter(m => m.action === 'map').length,
            stores: enhancedDiscovered.stores.filter(s => s.action === 'map').length,
            advisors: enhancedDiscovered.advisors.filter(a => a.action === 'map_user').length
          }
        },
        existing: {
          markets: existingMarkets.rows,
          stores: existingStores.rows,
          users: existingUsers.rows
        }
      });

    } catch (error) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }

  } catch (error) {
    console.error('Services discovery error:', error);
    res.status(500).json({ 
      message: 'Failed to process services file', 
      error: error.message 
    });
  }
});

// Enhanced Operations Upload - Step 1: Parse and discover
router.post('/upload/operations/discover', upload.single('file'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const processor = new UploadProcessor(pool);
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { reportDate } = req.body;
    if (!reportDate) {
      return res.status(400).json({ message: 'Report date is required' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    const filePath = req.file.path;
    
    try {
      // Process the file and discover entities
      const result = await processor.processOperationsFile(
        filePath, 
        req.file.originalname, 
        reportDate, 
        req.user.id
      );

      // Get existing markets and stores for mapping suggestions
      const existingMarkets = await pool.query('SELECT id, name FROM markets ORDER BY name');
      const existingStores = await pool.query('SELECT id, name, market_id FROM stores ORDER BY name');

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({
        message: 'Operations file parsed successfully',
        sessionId: result.sessionId,
        fileInfo: result.fileInfo,
        discovered: result.discovered,
        summary: result.summary,
        existing: {
          markets: existingMarkets.rows,
          stores: existingStores.rows
        }
      });

    } catch (error) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }

  } catch (error) {
    console.error('Operations discovery error:', error);
    res.status(500).json({ 
      message: 'Failed to process operations file', 
      error: error.message 
    });
  }
});

// Step 2: Confirm and process upload session
router.post('/upload/confirm/:sessionId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const processor = new UploadProcessor(pool);
    const { sessionId } = req.params;
    const confirmationData = req.body;

    // Validate confirmation data structure
    if (!confirmationData.markets || !confirmationData.stores) {
      return res.status(400).json({ 
        message: 'Market and store confirmation data required' 
      });
    }

    // Process the confirmed data
    const result = await processor.confirmUploadSession(sessionId, confirmationData);

    // Create file upload record for compatibility
    const session = await processor.getUploadSession(sessionId);
    await pool.query(`
      INSERT INTO file_uploads (filename, file_type, upload_date, uploaded_by, status, processed_at)
      VALUES ($1, $2, $3, $4, 'completed', CURRENT_TIMESTAMP)
    `, [
      session.filename,
      session.file_type,
      session.report_date,
      session.uploaded_by
    ]);

    res.json({
      message: 'Upload processed successfully',
      sessionId,
      processedCount: result.processedCount,
      mappings: {
        markets: Object.keys(result.marketMappings).length,
        stores: Object.keys(result.storeMappings).length,
        advisors: Object.keys(result.advisorMappings).length
      }
    });

  } catch (error) {
    console.error('Upload confirmation error:', error);
    res.status(500).json({ 
      message: 'Failed to confirm upload', 
      error: error.message 
    });
  }
});

// Get upload session details
router.get('/upload/session/:sessionId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const processor = new UploadProcessor(pool);
    const { sessionId } = req.params;

    const session = await processor.getUploadSession(sessionId);
    
    res.json({
      session,
      discovered: {
        markets: session.discovered_markets,
        stores: session.discovered_stores,
        advisors: session.discovered_advisors
      }
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ 
      message: 'Failed to get session details', 
      error: error.message 
    });
  }
});

// Get pending upload sessions
router.get('/upload/sessions/pending', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT 
        id, filename, file_type, report_date, market_id,
        status, created_at,
        jsonb_array_length(discovered_markets) as markets_count,
        jsonb_array_length(discovered_stores) as stores_count,
        jsonb_array_length(discovered_advisors) as advisors_count
      FROM upload_sessions 
      WHERE status = 'pending_review' 
      ORDER BY created_at DESC
    `);
    
    res.json({
      pendingSessions: result.rows
    });

  } catch (error) {
    console.error('Get pending sessions error:', error);
    res.status(500).json({ 
      message: 'Failed to get pending sessions', 
      error: error.message 
    });
  }
});

// Cancel upload session
router.delete('/upload/session/:sessionId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { sessionId } = req.params;

    await pool.query(`
      UPDATE upload_sessions 
      SET status = 'cancelled' 
      WHERE id = $1 AND status = 'pending_review'
    `, [sessionId]);
    
    res.json({ message: 'Upload session cancelled' });

  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ 
      message: 'Failed to cancel session', 
      error: error.message 
    });
  }
});

module.exports = router;