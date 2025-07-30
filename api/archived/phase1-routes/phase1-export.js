const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// =========================================
// JSON EXPORT ROUTES FOR PHASE 1
// =========================================

// GET /api/phase1/export/users - Export users.json
router.get('/users', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can export data
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get all users with their assignments
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.vendor,
        u.status,
        -- Get assigned markets
        COALESCE(
          (SELECT json_agg(m.name) 
           FROM user_market_assignments uma 
           JOIN markets m ON m.id::text = uma.market_id 
           WHERE uma.user_id = u.user_id), '[]'::json
        ) as markets,
        -- Get assigned stores  
        COALESCE(
          (SELECT json_agg(s.name)
           FROM user_store_assignments usa
           JOIN stores s ON s.store_id = usa.store_id
           WHERE usa.user_id = u.user_id), '[]'::json
        ) as stores
      FROM users u
      ORDER BY u.created_at
    `);
    
    const usersJson = result.rows.map(user => ({
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      vendor: user.vendor,
      markets: user.markets || [],
      stores: user.stores || []
    }));
    
    // Save to file
    const exportDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, 'users.json');
    await fs.writeFile(filePath, JSON.stringify(usersJson, null, 2));
    
    res.json({
      message: 'Users exported successfully',
      file_path: filePath,
      record_count: usersJson.length,
      data: usersJson
    });
    
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/export/markets - Export markets.json
router.get('/markets', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can export data
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        id::text as market_id,
        name as market_name,
        COALESCE(vendor_tags, '{}') as vendor_tags,
        description
      FROM markets
      ORDER BY name
    `);
    
    const marketsJson = result.rows.map(market => ({
      market_id: market.market_id,
      market_name: market.market_name,
      vendor_tags: market.vendor_tags || []
    }));
    
    // Save to file
    const exportDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, 'markets.json');
    await fs.writeFile(filePath, JSON.stringify(marketsJson, null, 2));
    
    res.json({
      message: 'Markets exported successfully',
      file_path: filePath,
      record_count: marketsJson.length,
      data: marketsJson
    });
    
  } catch (error) {
    console.error('Error exporting markets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/export/stores - Export stores.json
router.get('/stores', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can export data
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        s.store_id,
        s.name as store_name,
        s.market_id::text as market_id,
        m.name as market_name
      FROM stores s
      JOIN markets m ON m.id = s.market_id
      ORDER BY m.name, s.name
    `);
    
    const storesJson = result.rows.map(store => ({
      store_id: store.store_id,
      store_name: store.store_name,
      market_id: store.market_id
    }));
    
    // Save to file
    const exportDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, 'stores.json');
    await fs.writeFile(filePath, JSON.stringify(storesJson, null, 2));
    
    res.json({
      message: 'Stores exported successfully',
      file_path: filePath,
      record_count: storesJson.length,
      data: storesJson
    });
    
  } catch (error) {
    console.error('Error exporting stores:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/export/advisor-mappings - Export advisor_mappings.json
router.get('/advisor-mappings', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can export data
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        am.employee_name,
        am.market_id,
        am.store_name,
        am.user_id
      FROM advisor_mappings am
      ORDER BY am.market_id, am.store_name, am.employee_name
    `);
    
    const mappingsJson = result.rows.map(mapping => ({
      employee_name: mapping.employee_name,
      market_id: mapping.market_id,
      store: mapping.store_name,
      user_id: mapping.user_id
    }));
    
    // Save to file
    const exportDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, 'advisor_mappings.json');
    await fs.writeFile(filePath, JSON.stringify(mappingsJson, null, 2));
    
    res.json({
      message: 'Advisor mappings exported successfully',
      file_path: filePath,
      record_count: mappingsJson.length,
      data: mappingsJson
    });
    
  } catch (error) {
    console.error('Error exporting advisor mappings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/export/all - Export all Phase 1 data
router.get('/all', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can export data
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Export all data types
    const exports = {};
    
    // Users
    const usersResult = await pool.query(`
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.vendor,
        -- Get assigned markets
        COALESCE(
          (SELECT json_agg(m.name) 
           FROM user_market_assignments uma 
           JOIN markets m ON m.id::text = uma.market_id 
           WHERE uma.user_id = u.user_id), '[]'::json
        ) as markets,
        -- Get assigned stores  
        COALESCE(
          (SELECT json_agg(s.name)
           FROM user_store_assignments usa
           JOIN stores s ON s.store_id = usa.store_id
           WHERE usa.user_id = u.user_id), '[]'::json
        ) as stores
      FROM users u
      ORDER BY u.created_at
    `);
    
    exports.users = usersResult.rows.map(user => ({
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      vendor: user.vendor,
      markets: user.markets || [],
      stores: user.stores || []
    }));
    
    // Markets
    const marketsResult = await pool.query(`
      SELECT 
        id::text as market_id,
        name as market_name,
        COALESCE(vendor_tags, '{}') as vendor_tags
      FROM markets
      ORDER BY name
    `);
    
    exports.markets = marketsResult.rows.map(market => ({
      market_id: market.market_id,
      market_name: market.market_name,
      vendor_tags: market.vendor_tags || []
    }));
    
    // Stores
    const storesResult = await pool.query(`
      SELECT 
        s.store_id,
        s.name as store_name,
        s.market_id::text as market_id
      FROM stores s
      ORDER BY s.market_id, s.name
    `);
    
    exports.stores = storesResult.rows.map(store => ({
      store_id: store.store_id,
      store_name: store.store_name,
      market_id: store.market_id
    }));
    
    // Advisor Mappings
    const mappingsResult = await pool.query(`
      SELECT 
        am.employee_name,
        am.market_id,
        am.store_name,
        am.user_id
      FROM advisor_mappings am
      ORDER BY am.market_id, am.store_name, am.employee_name
    `);
    
    exports.advisor_mappings = mappingsResult.rows.map(mapping => ({
      employee_name: mapping.employee_name,
      market_id: mapping.market_id,
      store: mapping.store_name,
      user_id: mapping.user_id
    }));
    
    // Save individual files and combined file
    const exportDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    // Individual files
    await fs.writeFile(path.join(exportDir, 'users.json'), JSON.stringify(exports.users, null, 2));
    await fs.writeFile(path.join(exportDir, 'markets.json'), JSON.stringify(exports.markets, null, 2));
    await fs.writeFile(path.join(exportDir, 'stores.json'), JSON.stringify(exports.stores, null, 2));
    await fs.writeFile(path.join(exportDir, 'advisor_mappings.json'), JSON.stringify(exports.advisor_mappings, null, 2));
    
    // Combined file
    const combinedData = {
      export_timestamp: new Date().toISOString(),
      phase: 'Phase 1 - User Management & Infrastructure',
      ...exports
    };
    await fs.writeFile(path.join(exportDir, 'phase1_complete_export.json'), JSON.stringify(combinedData, null, 2));
    
    res.json({
      message: 'All Phase 1 data exported successfully',
      export_directory: exportDir,
      files: [
        'users.json',
        'markets.json', 
        'stores.json',
        'advisor_mappings.json',
        'phase1_complete_export.json'
      ],
      summary: {
        users: exports.users.length,
        markets: exports.markets.length,
        stores: exports.stores.length,
        advisor_mappings: exports.advisor_mappings.length
      },
      data: combinedData
    });
    
  } catch (error) {
    console.error('Error exporting all Phase 1 data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/phase1/export/vendor-access-report - Generate vendor partner access report
router.get('/vendor-access-report', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Check permissions - only admin can generate reports
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.name as vendor_partner_name,
        u.email,
        u.vendor,
        -- Get markets accessible to this vendor
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'market_id', m.id::text,
              'market_name', m.name,
              'store_count', (SELECT COUNT(*) FROM stores WHERE market_id = m.id)
            )
          )
           FROM markets m 
           WHERE u.vendor = ANY(COALESCE(m.vendor_tags, '{}'))
          ), '[]'::json
        ) as accessible_markets
      FROM users u
      WHERE u.role = 'vendor_partner' AND u.status = 'active'
      ORDER BY u.vendor, u.name
    `);
    
    const report = {
      generated_at: new Date().toISOString(),
      report_type: 'Vendor Partner Access Report',
      vendor_partners: result.rows
    };
    
    // Save report
    const exportDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    const filePath = path.join(exportDir, 'vendor_access_report.json');
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    
    res.json({
      message: 'Vendor access report generated successfully',
      file_path: filePath,
      vendor_partner_count: result.rows.length,
      report
    });
    
  } catch (error) {
    console.error('Error generating vendor access report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;