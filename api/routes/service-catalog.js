const express = require('express');
const router = express.Router();

// =========================================
// SERVICE CATALOG ROUTES
// =========================================

// GET /api/service-catalog - Get all services organized by category
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT 
        id, 
        service_name, 
        service_category, 
        display_order
      FROM service_catalog 
      ORDER BY service_category, display_order, service_name
    `);
    
    // Group services by category
    const servicesByCategory = {};
    result.rows.forEach(service => {
      if (!servicesByCategory[service.service_category]) {
        servicesByCategory[service.service_category] = [];
      }
      servicesByCategory[service.service_category].push(service);
    });
    
    res.json({
      services: result.rows,
      servicesByCategory
    });
    
  } catch (error) {
    console.error('Error fetching service catalog:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/service-catalog/categories - Get unique categories
router.get('/categories', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT DISTINCT service_category
      FROM service_catalog 
      ORDER BY service_category
    `);
    
    res.json({
      categories: result.rows.map(row => row.service_category)
    });
    
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;