const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelParser = require('../services/excelParser');

const router = express.Router();

// Helper function to log parsed filename information
function logFileInfo(fileInfo, originalFilename) {
  console.log(`📁 Processing ${fileInfo.format} format file:`, {
    filename: originalFilename,
    marketId: fileInfo.marketId,
    market: fileInfo.market,
    date: fileInfo.date,
    time: fileInfo.time,
    type: fileInfo.type,
    hash: fileInfo.hash
  });
}

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

const excelParser = new ExcelParser();

// Upload Services file
router.post('/upload/services', upload.single('file'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { reportDate } = req.body;
    if (!reportDate) {
      return res.status(400).json({ message: 'Report date is required' });
    }

    const userId = req.user.id;
    const filePath = req.file.path;
    
    // Parse filename
    const fileInfo = excelParser.parseFileName(req.file.originalname);
    if (!fileInfo.isValid) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: fileInfo.error });
    }
    
    // Log parsed filename information
    logFileInfo(fileInfo, req.file.originalname);
    
    // Create file upload record
    const uploadResult = await pool.query(`
      INSERT INTO file_uploads (filename, file_type, upload_date, uploaded_by, status)
      VALUES ($1, $2, $3, $4, 'processing')
      RETURNING id
    `, [req.file.originalname, fileInfo.type, reportDate, userId]);
    
    const uploadId = uploadResult.rows[0].id;

    try {
      // Parse the Excel file
      const parsedData = excelParser.parseServicesFile(filePath);
      
      // Validate data
      if (!parsedData.stores.length && !parsedData.employees.length && !parsedData.markets.length) {
        throw new Error('No valid data found in the uploaded file');
      }

      // Process employees (advisors)
      let processedCount = 0;
      
      for (const employee of parsedData.employees) {
        if (employee.employeeName) {
          // Find market and store
          const marketResult = await pool.query(
            'SELECT id FROM phase1_markets WHERE name = $1',
            [employee.market]
          );
          
          const storeResult = await pool.query(
            'SELECT store_id as id FROM phase1_stores WHERE name = $1',
            [employee.storeName]
          );
          
          const marketId = marketResult.rows[0]?.id || null;
          const storeId = storeResult.rows[0]?.id || null;
          
          // Check if advisor mapping exists
          const mappingResult = await pool.query(
            'SELECT user_id FROM advisor_mappings WHERE spreadsheet_name = $1 AND is_active = true',
            [employee.employeeName]
          );
          
          const advisorUserId = mappingResult.rows[0]?.user_id || null;
          
          // Store performance data
          await pool.query(`
            INSERT INTO performance_data 
            (upload_date, data_type, market_id, store_id, advisor_user_id, data)
            VALUES ($1, 'services', $2, $3, $4, $5)
          `, [
            reportDate,
            marketId,
            storeId,
            advisorUserId,
            JSON.stringify(employee)
          ]);
          
          processedCount++;
        }
      }

      // Update upload status
      await pool.query(
        'UPDATE file_uploads SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', uploadId]
      );

      // Clean up file
      fs.unlinkSync(filePath);

      res.json({
        message: 'Services file processed successfully',
        uploadId,
        market: fileInfo.market,
        processedCount,
        summary: {
          employees: parsedData.employees.length,
          stores: parsedData.stores.length,
          markets: parsedData.markets.length
        }
      });

    } catch (error) {
      // Mark as failed
      await pool.query(
        'UPDATE file_uploads SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', error.message, uploadId]
      );
      
      // Clean up file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      throw error;
    }

  } catch (error) {
    console.error('Services file upload error:', error);
    res.status(500).json({ 
      message: 'Failed to process Services file', 
      error: error.message 
    });
  }
});

// Upload Operations file
router.post('/upload/operations', upload.single('file'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { reportDate } = req.body;
    if (!reportDate) {
      return res.status(400).json({ message: 'Report date is required' });
    }

    const userId = req.user.id;
    const filePath = req.file.path;
    
    // Parse filename
    const fileInfo = excelParser.parseFileName(req.file.originalname);
    if (!fileInfo.isValid) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: fileInfo.error });
    }
    
    // Log parsed filename information
    logFileInfo(fileInfo, req.file.originalname);
    
    // Create file upload record
    const uploadResult = await pool.query(`
      INSERT INTO file_uploads (filename, file_type, upload_date, uploaded_by, status)
      VALUES ($1, $2, $3, $4, 'processing')
      RETURNING id
    `, [req.file.originalname, fileInfo.type, reportDate, userId]);
    
    const uploadId = uploadResult.rows[0].id;

    try {
      // Parse the Excel file
      const parsedData = excelParser.parseOperationsFile(filePath);
      
      // Validate data
      if (!parsedData.yesterday.length && !parsedData.yearOverYear.length) {
        throw new Error('No valid data found in the uploaded file');
      }

      // Process operations data
      let processedCount = 0;
      const allData = [...parsedData.yesterday, ...parsedData.yearOverYear];
      
      for (const record of allData) {
        // Find market and store
        const marketResult = await pool.query(
          'SELECT id FROM phase1_markets WHERE name = $1',
          [record.market]
        );
        
        const storeResult = await pool.query(
          'SELECT store_id as id FROM phase1_stores WHERE name = $1',
          [record.storeName]
        );
        
        const marketId = marketResult.rows[0]?.id || null;
        const storeId = storeResult.rows[0]?.id || null;
        
        // Store performance data
        await pool.query(`
          INSERT INTO performance_data 
          (upload_date, data_type, market_id, store_id, data)
          VALUES ($1, 'operations', $2, $3, $4)
        `, [
          reportDate,
          marketId,
          storeId,
          JSON.stringify(record)
        ]);
        
        processedCount++;
      }

      // Update upload status
      await pool.query(
        'UPDATE file_uploads SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', uploadId]
      );

      // Clean up file
      fs.unlinkSync(filePath);

      res.json({
        message: 'Operations file processed successfully',
        uploadId,
        market: fileInfo.market,
        processedCount,
        summary: {
          yesterday: parsedData.yesterday.length,
          yearOverYear: parsedData.yearOverYear.length
        }
      });

    } catch (error) {
      // Mark as failed  
      await pool.query(
        'UPDATE file_uploads SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', error.message, uploadId]
      );
      
      // Clean up file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      throw error;
    }

  } catch (error) {
    console.error('Operations file upload error:', error);
    res.status(500).json({ 
      message: 'Failed to process Operations file', 
      error: error.message 
    });
  }
});

// Parse file and get unique advisors for mapping
router.post('/parse-advisors', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    
    try {
      // Parse the file
      const fileInfo = excelParser.parseFileName(req.file.originalname);
      
      if (!fileInfo.isValid) {
        throw new Error(fileInfo.error);
      }
      
      if (fileInfo.type !== 'services') {
        throw new Error('Only services files contain advisor data');
      }
      
      // Parse the Excel file
      const parsedData = excelParser.parseServicesFile(filePath);
      
      // Extract unique advisors
      const uniqueAdvisors = excelParser.extractUniqueAdvisors(parsedData);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      res.json({
        market: fileInfo.market,
        advisors: uniqueAdvisors,
        count: uniqueAdvisors.length
      });
      
    } catch (error) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error parsing advisors:', error);
    res.status(500).json({ 
      message: 'Failed to parse advisors', 
      error: error.message 
    });
  }
});

// Get advisor mappings
router.get('/advisor-mappings', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT 
        am.id,
        am.spreadsheet_name as "spreadsheetName",
        am.user_id as "userId",
        u.first_name || ' ' || u.last_name as "userName",
        am.market_id as "marketId",
        m.name as "marketName",
        am.store_id as "storeId",
        s.name as "storeName",
        am.is_active as "isActive",
        am.created_at as "createdAt"
      FROM advisor_mappings am
      LEFT JOIN users u ON am.user_id = u.id
      LEFT JOIN markets m ON am.market_id = m.id
      LEFT JOIN stores s ON am.store_id = s.id
      ORDER BY am.spreadsheet_name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching advisor mappings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create advisor mapping
router.post('/advisor-mappings', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { spreadsheetName, userId, marketId, storeId } = req.body;
    
    if (!spreadsheetName || !userId) {
      return res.status(400).json({ 
        message: 'Spreadsheet name and user ID are required' 
      });
    }
    
    const result = await pool.query(`
      INSERT INTO advisor_mappings 
      (spreadsheet_name, user_id, market_id, store_id)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        spreadsheet_name as "spreadsheetName",
        user_id as "userId",
        market_id as "marketId",
        store_id as "storeId",
        is_active as "isActive",
        created_at as "createdAt"
    `, [spreadsheetName, userId, marketId, storeId]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating advisor mapping:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get upload history
router.get('/uploads', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { limit = 20 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        id,
        filename,
        file_type as "fileType",
        upload_date as "uploadDate",
        processed_at as "processedAt",
        status,
        error_message as "errorMessage",
        uploaded_by as "uploadedBy"
      FROM file_uploads
      ORDER BY upload_date DESC
      LIMIT $1
    `, [limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting upload history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;