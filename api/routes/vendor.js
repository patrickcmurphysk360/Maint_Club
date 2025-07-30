const express = require('express');
const router = express.Router();

// GET all vendor product mappings
router.get('/product-mappings', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT 
        vpm.id,
        vpm.vendor_id as "vendorId",
        vt.name as "vendorName",
        vpm.service_field as "serviceField",
        vpm.product_name as "productName",
        vpm.description,
        vpm.created_at as "createdAt",
        vpm.updated_at as "updatedAt"
      FROM vendor_product_mappings vpm
      JOIN vendor_tags vt ON vpm.vendor_id = vt.id
      ORDER BY vt.name, vpm.service_field
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor product mappings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET vendor product mappings by vendor ID
router.get('/product-mappings/:vendorId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { vendorId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id,
        vendor_id as "vendorId",
        service_field as "serviceField",
        product_name as "productName",
        description,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM vendor_product_mappings
      WHERE vendor_id = $1
      ORDER BY service_field
    `, [vendorId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor product mappings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// CREATE vendor product mapping
router.post('/product-mappings', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { vendorId, serviceField, productName, description } = req.body;
    
    if (!vendorId || !serviceField || !productName) {
      return res.status(400).json({ 
        message: 'Vendor ID, service field, and product name are required' 
      });
    }
    
    const result = await pool.query(`
      INSERT INTO vendor_product_mappings 
      (vendor_id, service_field, product_name, description)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        vendor_id as "vendorId",
        service_field as "serviceField",
        product_name as "productName",
        description,
        created_at as "createdAt"
    `, [vendorId, serviceField, productName, description]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vendor product mapping:', error);
    if (error.code === '23505') {
      res.status(409).json({ 
        message: 'Product mapping for this vendor and service field already exists' 
      });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// UPDATE vendor product mapping
router.put('/product-mappings/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { serviceField, productName, description } = req.body;
    
    if (!serviceField || !productName) {
      return res.status(400).json({ 
        message: 'Service field and product name are required' 
      });
    }
    
    const result = await pool.query(`
      UPDATE vendor_product_mappings
      SET 
        service_field = $2,
        product_name = $3,
        description = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING 
        id,
        vendor_id as "vendorId",
        service_field as "serviceField",
        product_name as "productName",
        description,
        updated_at as "updatedAt"
    `, [id, serviceField, productName, description]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product mapping not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vendor product mapping:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE vendor product mapping
router.delete('/product-mappings/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM vendor_product_mappings WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product mapping not found' });
    }
    
    res.json({ message: 'Product mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor product mapping:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET all service fields (for dropdown)
router.get('/service-fields', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Get all services from service_catalog table
    const result = await pool.query(`
      SELECT service_name
      FROM service_catalog
      WHERE active = true
      ORDER BY display_order, service_name
    `);
    
    // Extract just the service names for the dropdown
    const serviceFields = result.rows.map(row => row.service_name);
    
    res.json(serviceFields);
  } catch (error) {
    console.error('Error fetching service fields:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET all vendor tags
router.get('/tags', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT id, name, description, color, 
             created_at as "createdAt"
      FROM vendor_tags
      ORDER BY name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;