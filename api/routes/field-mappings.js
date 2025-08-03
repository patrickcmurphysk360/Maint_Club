const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Get effective field mappings for a market (combines defaults + overrides)
router.get('/:marketId?', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    
    console.log(`🗺️ Getting field mappings for market: ${marketId || 'global defaults'}`);
    
    let result;
    if (marketId && marketId !== 'default') {
      // Get effective mappings for specific market (overrides + defaults)
      result = await pool.query(
        'SELECT * FROM get_effective_field_mappings($1) ORDER BY sort_order, spreadsheet_header',
        [parseInt(marketId)]
      );
    } else {
      // Get global defaults only
      result = await pool.query(`
        SELECT 
          spreadsheet_header,
          scorecard_field_key,
          field_type,
          data_field_name,
          display_label,
          is_percentage,
          sort_order,
          FALSE as is_override
        FROM default_field_mappings 
        WHERE is_active = TRUE 
        ORDER BY sort_order, spreadsheet_header
      `);
    }
    
    console.log(`📊 Found ${result.rows.length} field mappings`);
    
    res.json({
      marketId: marketId || null,
      mappings: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings', details: error.message });
  }
});

// Update default field mapping
router.put('/default/:mappingId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { mappingId } = req.params;
    const mapping = req.body;
    
    console.log(`🔄 Updating default field mapping ${mappingId}`);
    
    const {
      spreadsheet_header,
      scorecard_field_key,
      field_type,
      data_field_name,
      display_label,
      is_percentage = false,
      sort_order = 0,
      is_active = true
    } = mapping;
    
    if (!spreadsheet_header || !scorecard_field_key || !field_type || !display_label) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    const result = await pool.query(`
      UPDATE default_field_mappings 
      SET 
        spreadsheet_header = $2,
        scorecard_field_key = $3,
        field_type = $4,
        data_field_name = $5,
        display_label = $6,
        is_percentage = $7,
        sort_order = $8,
        is_active = $9,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      parseInt(mappingId),
      spreadsheet_header,
      scorecard_field_key,
      field_type,
      data_field_name,
      display_label,
      is_percentage,
      sort_order,
      is_active
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    console.log(`✅ Updated default field mapping: ${spreadsheet_header}`);
    
    res.json({
      success: true,
      message: 'Default field mapping updated successfully',
      mapping: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error updating default field mapping:', error);
    res.status(500).json({ error: 'Failed to update default field mapping', details: error.message });
  }
});

// Update field mappings for a market
router.post('/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    const { mappings, action = 'update' } = req.body;
    
    console.log(`🔄 ${action} field mappings for market ${marketId}: ${mappings?.length || 0} mappings`);
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ error: 'Mappings array is required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (action === 'replace') {
        // Delete existing market-specific mappings
        await client.query(
          'DELETE FROM service_field_mappings WHERE market_id = $1',
          [parseInt(marketId)]
        );
        console.log(`🗑️ Cleared existing mappings for market ${marketId}`);
      }
      
      // Insert/update mappings
      let insertedCount = 0;
      let updatedCount = 0;
      
      for (const mapping of mappings) {
        const {
          spreadsheet_header,
          scorecard_field_key,
          field_type,
          data_field_name,
          display_label,
          is_percentage = false,
          sort_order = 0,
          is_active = true
        } = mapping;
        
        if (!spreadsheet_header || !scorecard_field_key || !field_type || !display_label) {
          console.warn(`⚠️ Skipping incomplete mapping:`, mapping);
          continue;
        }
        
        if (action === 'replace' || action === 'insert') {
          // Insert new mapping
          await client.query(`
            INSERT INTO service_field_mappings 
            (market_id, spreadsheet_header, scorecard_field_key, field_type, data_field_name, display_label, is_percentage, sort_order, is_active, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (market_id, spreadsheet_header, scorecard_field_key)
            DO UPDATE SET
              field_type = EXCLUDED.field_type,
              data_field_name = EXCLUDED.data_field_name,
              display_label = EXCLUDED.display_label,
              is_percentage = EXCLUDED.is_percentage,
              sort_order = EXCLUDED.sort_order,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
          `, [
            parseInt(marketId),
            spreadsheet_header,
            scorecard_field_key,
            field_type,
            data_field_name,
            display_label,
            is_percentage,
            sort_order,
            is_active
          ]);
          
          insertedCount++;
        }
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ Updated field mappings: ${insertedCount} inserted/updated`);
      
      res.json({
        success: true,
        message: `Successfully updated field mappings for market ${marketId}`,
        inserted: insertedCount,
        updated: updatedCount
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error updating field mappings:', error);
    res.status(500).json({ error: 'Failed to update field mappings', details: error.message });
  }
});

// Discover headers from uploaded spreadsheet file
router.post('/discover-headers', upload.single('file'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`🔍 Discovering headers from file: ${req.file.originalname}`);
    
    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const discoveredHeaders = {};
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length > 0) {
        const headers = data[0] || [];
        const sampleData = data.slice(1, 6); // Get first 5 data rows as samples
        
        discoveredHeaders[sheetName] = headers.map((header, index) => {
          if (!header || header === '') return null;
          
          const sampleValues = sampleData
            .map(row => row[index])
            .filter(val => val !== null && val !== undefined && val !== '');
          
          return {
            header_name: header.toString(),
            column_position: index,
            sample_values: sampleValues.slice(0, 3), // First 3 non-empty samples
            sheet_name: sheetName
          };
        }).filter(Boolean);
      }
    }
    
    // Save discovered headers to database if marketId provided
    if (marketId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Clear old discoveries for this file/market
        await client.query(
          'DELETE FROM discovered_spreadsheet_headers WHERE market_id = $1 AND spreadsheet_filename = $2',
          [parseInt(marketId), req.file.originalname]
        );
        
        // Insert new discoveries
        for (const [sheetName, headers] of Object.entries(discoveredHeaders)) {
          for (const headerInfo of headers) {
            await client.query(`
              INSERT INTO discovered_spreadsheet_headers 
              (market_id, spreadsheet_filename, header_name, sheet_name, column_position, sample_values, discovered_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [
              parseInt(marketId),
              req.file.originalname,
              headerInfo.header_name,
              headerInfo.sheet_name,
              headerInfo.column_position,
              headerInfo.sample_values
            ]);
          }
        }
        
        await client.query('COMMIT');
        console.log(`💾 Saved discovered headers to database for market ${marketId}`);
      } finally {
        client.release();
      }
    }
    
    // Get current mappings to check what's already mapped
    const currentMappings = await pool.query(`
      SELECT DISTINCT spreadsheet_header 
      FROM get_effective_field_mappings($1)
    `, [marketId ? parseInt(marketId) : null]);
    
    const mappedHeaders = new Set(currentMappings.rows.map(r => r.spreadsheet_header));
    
    // Mark headers as mapped/unmapped
    const headerAnalysis = {};
    for (const [sheetName, headers] of Object.entries(discoveredHeaders)) {
      headerAnalysis[sheetName] = headers.map(header => ({
        ...header,
        is_mapped: mappedHeaders.has(header.header_name),
        suggested_mapping: findSuggestedMapping(header.header_name)
      }));
    }
    
    const totalHeaders = Object.values(discoveredHeaders).reduce((sum, headers) => sum + headers.length, 0);
    const mappedCount = Object.values(headerAnalysis).reduce((sum, headers) => 
      sum + headers.filter(h => h.is_mapped).length, 0
    );
    
    console.log(`📊 Discovered ${totalHeaders} headers, ${mappedCount} already mapped`);
    
    res.json({
      filename: req.file.originalname,
      marketId: marketId || null,
      sheets: headerAnalysis,
      summary: {
        total_headers: totalHeaders,
        mapped_headers: mappedCount,
        unmapped_headers: totalHeaders - mappedCount,
        sheet_count: Object.keys(discoveredHeaders).length
      }
    });
    
  } catch (error) {
    console.error('❌ Error discovering headers:', error);
    res.status(500).json({ error: 'Failed to discover headers', details: error.message });
  }
});

// Preview mapping results without saving
router.post('/preview', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId, mappings, sampleData } = req.body;
    
    console.log(`🔍 Previewing mapping results for market ${marketId}`);
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ error: 'Mappings array is required' });
    }
    
    // Create mapping lookup
    const mappingLookup = {};
    mappings.forEach(mapping => {
      mappingLookup[mapping.spreadsheet_header] = mapping;
    });
    
    // If sample data provided, show how it would be mapped
    let mappingPreview = null;
    if (sampleData && Array.isArray(sampleData) && sampleData.length > 0) {
      const headers = sampleData[0];
      const dataRows = sampleData.slice(1, 4); // Preview first 3 data rows
      
      mappingPreview = dataRows.map((row, rowIndex) => {
        const mappedRow = {
          original_row: row,
          mapped_data: {},
          unmapped_fields: []
        };
        
        headers.forEach((header, colIndex) => {
          const mapping = mappingLookup[header];
          if (mapping) {
            mappedRow.mapped_data[mapping.scorecard_field_key] = {
              value: row[colIndex],
              field_type: mapping.field_type,
              data_field_name: mapping.data_field_name,
              display_label: mapping.display_label
            };
          } else {
            mappedRow.unmapped_fields.push({
              header: header,
              value: row[colIndex],
              column_index: colIndex
            });
          }
        });
        
        return mappedRow;
      });
    }
    
    // Analyze mapping coverage
    const mappingAnalysis = {
      total_mappings: mappings.length,
      by_type: {
        direct: mappings.filter(m => m.field_type === 'direct').length,
        nested: mappings.filter(m => m.field_type === 'nested').length,
        calculated: mappings.filter(m => m.field_type === 'calculated').length,
        percentage: mappings.filter(m => m.field_type === 'percentage').length
      },
      percentages: mappings.filter(m => m.is_percentage).length,
      potential_conflicts: findMappingConflicts(mappings)
    };
    
    res.json({
      marketId: marketId || null,
      mapping_analysis: mappingAnalysis,
      mapping_preview: mappingPreview,
      validation_results: validateMappings(mappings)
    });
    
  } catch (error) {
    console.error('❌ Error previewing mappings:', error);
    res.status(500).json({ error: 'Failed to preview mappings', details: error.message });
  }
});

// Get discovered headers for a market
router.get('/:marketId/discovered-headers', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    const { filename } = req.query;
    
    let query = `
      SELECT 
        spreadsheet_filename,
        header_name,
        sheet_name,
        column_position,
        sample_values,
        is_mapped,
        discovered_at
      FROM discovered_spreadsheet_headers 
      WHERE market_id = $1
    `;
    const params = [parseInt(marketId)];
    
    if (filename) {
      query += ' AND spreadsheet_filename = $2';
      params.push(filename);
    }
    
    query += ' ORDER BY discovered_at DESC, sheet_name, column_position';
    
    const result = await pool.query(query, params);
    
    console.log(`📋 Found ${result.rows.length} discovered headers for market ${marketId}`);
    
    res.json({
      marketId: parseInt(marketId),
      discovered_headers: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error fetching discovered headers:', error);
    res.status(500).json({ error: 'Failed to fetch discovered headers', details: error.message });
  }
});

// Helper functions
function findSuggestedMapping(headerName) {
  const header = headerName.toLowerCase().trim();
  
  // Common mapping suggestions based on header name
  const suggestions = {
    'id': 'storeid',
    'store id': 'storeid',
    'market': 'market',
    'store': 'storename',
    'employee': 'employeename',
    'sales': 'sales',
    'gp sales': 'gpsales',
    'gp percent': 'gppercent',
    'gp %': 'gppercent',
    'invoices': 'invoices',
    'oil change': 'oilchange',
    'premium oil change': 'premiumoilchange',
    'brake service': 'brakeservice',
    'brake flush': 'brakeflush',
    'brake flush to service %': 'brakeflushtoservice%',
    'tire protection': 'tireprotection',
    'tire protection %': 'tireprotection%',
    'all tires': 'alltires',
    'retail tires': 'retailtires',
    'alignments': 'alignments',
    'potential alignments': 'potentialalignments',
    'potential alignments sold': 'potentialalignmentssold',
    'potential alignments %': 'potentialalignments%'
  };
  
  return suggestions[header] || null;
}

function findMappingConflicts(mappings) {
  const conflicts = [];
  const scorecardFieldUsage = {};
  const dataFieldUsage = {};
  
  mappings.forEach((mapping, index) => {
    // Check for duplicate scorecard field keys
    if (scorecardFieldUsage[mapping.scorecard_field_key]) {
      conflicts.push({
        type: 'duplicate_scorecard_field',
        field: mapping.scorecard_field_key,
        headers: [scorecardFieldUsage[mapping.scorecard_field_key], mapping.spreadsheet_header]
      });
    } else {
      scorecardFieldUsage[mapping.scorecard_field_key] = mapping.spreadsheet_header;
    }
    
    // Check for duplicate data field names (for direct mappings)
    if (mapping.field_type === 'direct' && mapping.data_field_name) {
      if (dataFieldUsage[mapping.data_field_name]) {
        conflicts.push({
          type: 'duplicate_data_field',
          field: mapping.data_field_name,
          headers: [dataFieldUsage[mapping.data_field_name], mapping.spreadsheet_header]
        });
      } else {
        dataFieldUsage[mapping.data_field_name] = mapping.spreadsheet_header;
      }
    }
  });
  
  return conflicts;
}

function validateMappings(mappings) {
  const errors = [];
  const warnings = [];
  
  mappings.forEach((mapping, index) => {
    // Required field validation
    if (!mapping.spreadsheet_header) {
      errors.push(`Mapping ${index}: spreadsheet_header is required`);
    }
    if (!mapping.scorecard_field_key) {
      errors.push(`Mapping ${index}: scorecard_field_key is required`);
    }
    if (!mapping.field_type) {
      errors.push(`Mapping ${index}: field_type is required`);
    }
    if (!mapping.display_label) {
      errors.push(`Mapping ${index}: display_label is required`);
    }
    
    // Field type validation
    const validTypes = ['direct', 'nested', 'calculated', 'percentage'];
    if (mapping.field_type && !validTypes.includes(mapping.field_type)) {
      errors.push(`Mapping ${index}: invalid field_type '${mapping.field_type}'`);
    }
    
    // Data field name required for direct mappings
    if (mapping.field_type === 'direct' && !mapping.data_field_name) {
      warnings.push(`Mapping ${index}: data_field_name recommended for direct field type`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = router;