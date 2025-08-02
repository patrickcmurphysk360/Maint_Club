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

    // Parse date from filename instead of relying on frontend reportDate
    const excelParser = new (require('../services/excelParser'))();
    const fileInfo = excelParser.parseFileName(req.file.originalname);
    
    if (!fileInfo.isValid) {
      return res.status(400).json({ 
        message: 'Invalid filename format', 
        error: fileInfo.error 
      });
    }
    
    // Handle date differently for end-of-month vs daily files
    let reportDate;
    if (fileInfo.isEndOfMonth) {
      // For end-of-month files, use the date as-is (last day of month)
      reportDate = fileInfo.date.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('📅 End-of-month file:', fileInfo.monthName, fileInfo.date.getFullYear(), '→ Report date:', reportDate, 'for file:', req.file.originalname);
    } else {
      // For daily files, use parsed date minus 1 day (MTD through prior day)
      const mtdDate = new Date(fileInfo.date);
      mtdDate.setDate(mtdDate.getDate() - 1);
      reportDate = mtdDate.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('📅 Daily file date:', fileInfo.date.toISOString().split('T')[0], '→ MTD date:', reportDate, 'for file:', req.file.originalname);
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
      const existingAdvisorMappings = await pool.query(`
        SELECT 
          am.spreadsheet_name,
          am.user_id,
          u.first_name,
          u.last_name,
          u.email
        FROM advisor_mappings am
        LEFT JOIN users u ON am.user_id::text = u.id::text
        WHERE am.is_active = true
      `);

      // Apply intelligent matching to discovered entities
      console.log('🔍 Discovered markets from spreadsheet:', result.discovered.markets.map(m => m.name));
      console.log('📋 Existing markets in database:', existingMarkets.rows.map(m => `${m.id}: ${m.name}`));
      console.log('👥 Existing advisor mappings:', existingAdvisorMappings.rows.map(m => `${m.advisor_name} -> ${m.user_id}`));
      console.log('🔍 Discovered advisors from spreadsheet:', result.discovered.advisors.map(a => a.name));
      
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
          // First, check if advisor is already mapped in advisor_mappings table
          const existingMapping = existingAdvisorMappings.rows.find(mapping => 
            mapping.spreadsheet_name === advisor.name
          );
          
          if (existingMapping) {
            // Advisor is already mapped - auto-map without confirmation
            const mappedUser = {
              id: existingMapping.user_id,
              first_name: existingMapping.first_name,
              last_name: existingMapping.last_name,
              email: existingMapping.email
            };
            
            return {
              ...advisor,
              suggestedMatch: mappedUser,
              matchScore: 1.0,
              action: 'map_user',
              existing_user_id: existingMapping.user_id,
              mappingSource: 'advisor_mappings_table'
            };
          }
          
          // If no existing mapping, fall back to fuzzy matching
          const match = processor.findBestAdvisorMatch(advisor.name, existingUsers.rows);
          return {
            ...advisor,
            suggestedMatch: match?.user,
            matchScore: match?.score,
            action: match && match.score > 0.8 ? 'map_user' : 'create_user',
            existing_user_id: match?.user?.id,
            mappingSource: 'fuzzy_matching'
          };
        })
      };

      // Check if we can auto-process (all entities matched)
      const allMarketsMatched = enhancedDiscovered.markets.every(m => m.action === 'map');
      const allStoresMatched = enhancedDiscovered.stores.every(s => s.action === 'map');
      const allAdvisorsMatched = enhancedDiscovered.advisors.every(a => a.action === 'map_user');
      
      let canAutoProcess = allMarketsMatched && allStoresMatched && allAdvisorsMatched;
      
      console.log('🚀 Auto-process check:', {
        allMarketsMatched,
        allStoresMatched,
        allAdvisorsMatched,
        canAutoProcess,
        marketCount: enhancedDiscovered.markets.length,
        storeCount: enhancedDiscovered.stores.length,
        advisorCount: enhancedDiscovered.advisors.length
      });

      // If everything matches, auto-process the upload
      if (canAutoProcess) {
        try {
          console.log('✅ All entities matched! Auto-processing upload...');
          
          // Build confirmation data for auto-processing
          // NOTE: UploadProcessor expects arrays, not objects with name keys
          const autoConfirmData = {
            markets: [],
            stores: [],
            advisors: []
          };
          
          // Map markets - convert to array format
          enhancedDiscovered.markets.forEach(market => {
            autoConfirmData.markets.push({
              name: market.name,
              action: 'map',
              existing_id: market.existing_id,
              mappedTo: market.existing_id,
              mappedName: market.suggestedMatch?.name,
              source: market.source
            });
          });
          
          // Map stores - convert to array format
          enhancedDiscovered.stores.forEach(store => {
            autoConfirmData.stores.push({
              name: store.name,
              action: 'map',
              existing_id: store.existing_id,
              mappedTo: store.existing_id,
              mappedName: store.suggestedMatch?.name,
              market: store.market,
              source: store.source
            });
          });
          
          // Map advisors - convert to array format
          enhancedDiscovered.advisors.forEach(advisor => {
            autoConfirmData.advisors.push({
              name: advisor.name,
              action: advisor.action, // Use the action from enhanced discovery (map_user or create_user)
              existing_user_id: advisor.existing_user_id,
              mappedTo: advisor.existing_user_id,
              mappedUserName: advisor.suggestedMatch?.first_name + ' ' + advisor.suggestedMatch?.last_name,
              store: advisor.store,
              market: advisor.market,
              hasData: advisor.hasData,
              source: advisor.source,
              mappingSource: advisor.mappingSource // Include mapping source info
            });
          });
          
          // Process the confirmation automatically
          const processResult = await processor.confirmUploadSession(result.sessionId, autoConfirmData);
          
          // Update session status to completed
          await pool.query(
            'UPDATE upload_sessions SET status = $1 WHERE id = $2',
            ['processed', result.sessionId]
          );
          
          // Create file upload record for compatibility
          await pool.query(`
            INSERT INTO file_uploads (filename, file_type, upload_date, uploaded_by, status, processed_at)
            VALUES ($1, $2, $3, $4, 'completed', CURRENT_TIMESTAMP)
          `, [
            req.file.originalname,
            'services',
            reportDate,
            req.user.id
          ]);
          
          // Clean up uploaded file
          fs.unlinkSync(filePath);
          
          res.json({
            message: 'Services file processed automatically - all entities matched!',
            sessionId: result.sessionId,
            fileInfo: result.fileInfo,
            autoProcessed: true,
            processedCount: processResult.processedCount,
            summary: {
              ...result.summary,
              autoMatched: {
                markets: enhancedDiscovered.markets.length,
                stores: enhancedDiscovered.stores.length,
                advisors: enhancedDiscovered.advisors.length,
                advisorsFromMappings: enhancedDiscovered.advisors.filter(a => a.mappingSource === 'advisor_mappings_table').length
              }
            }
          });
          
        } catch (autoProcessError) {
          console.error('❌ Auto-process failed, falling back to manual review:', autoProcessError);
          // If auto-process fails, fall back to manual review
          canAutoProcess = false;
        }
      }
      
      // If not auto-processed, return for manual review
      if (!canAutoProcess) {
        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
          message: 'Services file parsed successfully',
          sessionId: result.sessionId,
          fileInfo: result.fileInfo,
          discovered: enhancedDiscovered,
          requiresReview: true,
          unmatchedEntities: {
            markets: enhancedDiscovered.markets.filter(m => m.action !== 'map').map(m => m.name),
            stores: enhancedDiscovered.stores.filter(s => s.action !== 'map').map(s => s.name),
            advisors: enhancedDiscovered.advisors.filter(a => a.action !== 'map_user').map(a => a.name)
          },
          summary: {
            ...result.summary,
            autoMatched: {
              markets: enhancedDiscovered.markets.filter(m => m.action === 'map').length,
              stores: enhancedDiscovered.stores.filter(s => s.action === 'map').length,
              advisors: enhancedDiscovered.advisors.filter(a => a.action === 'map_user').length,
              advisorsFromMappings: enhancedDiscovered.advisors.filter(a => a.mappingSource === 'advisor_mappings_table').length,
              advisorsFromFuzzy: enhancedDiscovered.advisors.filter(a => a.mappingSource === 'fuzzy_matching' && a.action === 'map_user').length
            }
          },
          existing: {
            markets: existingMarkets.rows,
            stores: existingStores.rows,
            users: existingUsers.rows
          }
        });
      }

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

    // Parse date from filename instead of relying on frontend reportDate
    const excelParser = new (require('../services/excelParser'))();
    const fileInfo = excelParser.parseFileName(req.file.originalname);
    
    if (!fileInfo.isValid) {
      return res.status(400).json({ 
        message: 'Invalid filename format', 
        error: fileInfo.error 
      });
    }
    
    // Handle date differently for end-of-month vs daily files
    let reportDate;
    if (fileInfo.isEndOfMonth) {
      // For end-of-month files, use the date as-is (last day of month)
      reportDate = fileInfo.date.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('📅 End-of-month operations file:', fileInfo.monthName, fileInfo.date.getFullYear(), '→ Report date:', reportDate, 'for file:', req.file.originalname);
    } else {
      // For daily files, use parsed date minus 1 day (MTD through prior day)
      const mtdDate = new Date(fileInfo.date);
      mtdDate.setDate(mtdDate.getDate() - 1);
      reportDate = mtdDate.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('📅 Daily operations file date:', fileInfo.date.toISOString().split('T')[0], '→ MTD date:', reportDate, 'for file:', req.file.originalname);
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
    
    // Enhance market data with existing mappings
    const enhancedMarkets = await Promise.all(
      session.discovered_markets.map(async (market) => {
        // Check if market already exists
        const existingMarket = await pool.query(
          'SELECT id, name FROM markets WHERE name = $1',
          [market.name]
        );
        
        if (existingMarket.rows.length > 0) {
          return {
            ...market,
            action: 'map',
            existing_id: existingMarket.rows[0].id
          };
        }
        
        return market;
      })
    );
    
    // Enhance store data with existing mappings
    const enhancedStores = await Promise.all(
      session.discovered_stores.map(async (store) => {
        // Check if store already exists
        const existingStore = await pool.query(
          'SELECT id, name, market_id FROM stores WHERE name = $1',
          [store.name]
        );
        
        if (existingStore.rows.length > 0) {
          return {
            ...store,
            action: 'map',
            existing_id: existingStore.rows[0].id,
            existing_market_id: existingStore.rows[0].market_id
          };
        }
        
        return store;
      })
    );
    
    // Enhance advisor data with existing mappings
    const enhancedAdvisors = await Promise.all(
      session.discovered_advisors.map(async (advisor) => {
        // Check if advisor already has a mapping
        const existingMapping = await pool.query(
          'SELECT user_id, spreadsheet_name FROM advisor_mappings WHERE spreadsheet_name = $1 AND is_active = true',
          [advisor.name]
        );
        
        if (existingMapping.rows.length > 0) {
          // Get user details for display
          const userDetails = await pool.query(
            'SELECT id, first_name, last_name FROM users WHERE id = $1',
            [existingMapping.rows[0].user_id]
          );
          
          return {
            ...advisor,
            action: 'map_user',
            existing_user_id: existingMapping.rows[0].user_id,
            mappedUserName: userDetails.rows[0] ? 
              `${userDetails.rows[0].first_name} ${userDetails.rows[0].last_name}` : 
              'Unknown User'
          };
        }
        
        return advisor;
      })
    );
    
    res.json({
      session,
      discovered: {
        markets: session.discovered_markets,
        stores: session.discovered_stores,
        advisors: session.discovered_advisors
      },
      enhanced: {
        markets: enhancedMarkets,
        stores: enhancedStores,
        advisors: enhancedAdvisors
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

    console.log('🗑️ Attempting to cancel session:', sessionId);
    
    const result = await pool.query(`
      UPDATE upload_sessions 
      SET status = 'cancelled' 
      WHERE id = $1 AND status = 'pending_review'
      RETURNING id, filename, status
    `, [sessionId]);
    
    if (result.rowCount === 0) {
      console.log('❌ Session not found or not pending:', sessionId);
      return res.status(404).json({ 
        message: 'Session not found or not in pending_review status' 
      });
    }
    
    console.log('✅ Session cancelled successfully:', result.rows[0]);
    res.json({ 
      message: 'Upload session cancelled', 
      session: result.rows[0] 
    });

  } catch (error) {
    console.error('❌ Cancel session error:', error);
    res.status(500).json({ 
      message: 'Failed to cancel session', 
      error: error.message 
    });
  }
});

module.exports = router;