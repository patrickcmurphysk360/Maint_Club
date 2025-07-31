const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all services with optional filters
router.get('/', async (req, res) => {
  try {
    console.log('Services-management GET /', req.query);
    const { category, is_calculated, active } = req.query;
    
    let query = `
      SELECT 
        id,
        service_name,
        service_category,
        display_order,
        description,
        active,
        is_calculated,
        calculation_type,
        calculation_formula,
        dependent_services,
        unit_type,
        created_at,
        (SELECT COUNT(*) FROM vendor_product_mappings WHERE service_catalog_id = sc.id) as mapping_count
      FROM service_catalog sc
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND service_category = $${paramCount}`;
      params.push(category);
    }
    
    if (is_calculated !== undefined) {
      paramCount++;
      query += ` AND is_calculated = $${paramCount}`;
      params.push(is_calculated === 'true');
    }
    
    if (active !== undefined) {
      paramCount++;
      query += ` AND active = $${paramCount}`;
      params.push(active === 'true');
    }
    
    query += ' ORDER BY display_order, service_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET service categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT service_category, COUNT(*) as service_count
      FROM service_catalog
      WHERE active = true
      GROUP BY service_category
      ORDER BY service_category
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET available services for calculations (non-calculated services only)
router.get('/available-for-calculation', async (req, res) => {
  try {
    console.log('Services-management GET /available-for-calculation');
    const result = await pool.query(`
      SELECT id, service_name, service_category, unit_type
      FROM service_catalog
      WHERE active = true AND is_calculated = false
      ORDER BY service_category, display_order, service_name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching available services:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single service by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id,
        service_name,
        service_category,
        display_order,
        description,
        active,
        is_calculated,
        calculation_type,
        calculation_formula,
        dependent_services,
        unit_type,
        created_at
      FROM service_catalog
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// CREATE new service
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const {
      service_name,
      service_category,
      display_order,
      description,
      active = true,
      is_calculated = false,
      calculation_type,
      calculation_formula,
      dependent_services,
      unit_type = 'count'
    } = req.body;
    
    if (!service_name || !service_category) {
      return res.status(400).json({ 
        message: 'Service name and category are required' 
      });
    }
    
    // Validate calculated service fields
    if (is_calculated) {
      if (!calculation_type || !calculation_formula || !dependent_services) {
        return res.status(400).json({ 
          message: 'Calculated services require calculation_type, calculation_formula, and dependent_services' 
        });
      }
    }
    
    const result = await pool.query(`
      INSERT INTO service_catalog (
        service_name,
        service_category,
        display_order,
        description,
        active,
        is_calculated,
        calculation_type,
        calculation_formula,
        dependent_services,
        unit_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      service_name,
      service_category,
      display_order || 999,
      description,
      active,
      is_calculated,
      calculation_type,
      calculation_formula,
      dependent_services ? JSON.stringify(dependent_services) : null,
      unit_type
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    if (error.code === '23505') {
      res.status(409).json({ 
        message: 'Service with this name already exists' 
      });
    } else if (error.message && error.message.includes('Dependent service')) {
      res.status(400).json({ 
        message: error.message 
      });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// UPDATE service
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { id } = req.params;
    const {
      service_name,
      service_category,
      display_order,
      description,
      active,
      is_calculated,
      calculation_type,
      calculation_formula,
      dependent_services,
      unit_type
    } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    if (service_name !== undefined) {
      paramCount++;
      updates.push(`service_name = $${paramCount}`);
      values.push(service_name);
    }
    
    if (service_category !== undefined) {
      paramCount++;
      updates.push(`service_category = $${paramCount}`);
      values.push(service_category);
    }
    
    if (display_order !== undefined) {
      paramCount++;
      updates.push(`display_order = $${paramCount}`);
      values.push(display_order);
    }
    
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }
    
    if (active !== undefined) {
      paramCount++;
      updates.push(`active = $${paramCount}`);
      values.push(active);
    }
    
    if (is_calculated !== undefined) {
      paramCount++;
      updates.push(`is_calculated = $${paramCount}`);
      values.push(is_calculated);
    }
    
    if (calculation_type !== undefined) {
      paramCount++;
      updates.push(`calculation_type = $${paramCount}`);
      values.push(calculation_type);
    }
    
    if (calculation_formula !== undefined) {
      paramCount++;
      updates.push(`calculation_formula = $${paramCount}`);
      values.push(calculation_formula);
    }
    
    if (dependent_services !== undefined) {
      paramCount++;
      updates.push(`dependent_services = $${paramCount}`);
      values.push(JSON.stringify(dependent_services));
    }
    
    if (unit_type !== undefined) {
      paramCount++;
      updates.push(`unit_type = $${paramCount}`);
      values.push(unit_type);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    paramCount++;
    values.push(id);
    
    const query = `
      UPDATE service_catalog
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service:', error);
    if (error.code === '23505') {
      res.status(409).json({ 
        message: 'Service with this name already exists' 
      });
    } else if (error.message && error.message.includes('Dependent service')) {
      res.status(400).json({ 
        message: error.message 
      });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// DELETE service
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { id } = req.params;
    
    // Check if service has mappings
    const mappingCheck = await pool.query(
      'SELECT COUNT(*) FROM vendor_product_mappings WHERE service_catalog_id = $1',
      [id]
    );
    
    if (parseInt(mappingCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete service with existing vendor mappings. Please remove mappings first.' 
      });
    }
    
    // Check if service is used in calculations
    const calculationCheck = await pool.query(`
      SELECT service_name 
      FROM service_catalog 
      WHERE is_calculated = true 
      AND dependent_services::jsonb @> $1::jsonb
    `, [JSON.stringify([id])]);
    
    if (calculationCheck.rows.length > 0) {
      const dependentServices = calculationCheck.rows.map(r => r.service_name).join(', ');
      return res.status(400).json({ 
        message: `Cannot delete service used in calculations: ${dependentServices}` 
      });
    }
    
    const result = await pool.query(
      'DELETE FROM service_catalog WHERE id = $1 RETURNING id, service_name',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    res.json({ 
      message: 'Service deleted successfully',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate calculation formula
router.post('/validate-formula', async (req, res) => {
  try {
    const { formula, dependent_services } = req.body;
    
    if (!formula || !dependent_services) {
      return res.status(400).json({ 
        message: 'Formula and dependent services are required' 
      });
    }
    
    // Check if all dependent services exist
    const serviceNames = dependent_services;
    const result = await pool.query(`
      SELECT service_name 
      FROM service_catalog 
      WHERE service_name = ANY($1)
    `, [serviceNames]);
    
    const foundServices = result.rows.map(r => r.service_name);
    const missingServices = serviceNames.filter(s => !foundServices.includes(s));
    
    if (missingServices.length > 0) {
      return res.json({
        valid: false,
        message: `Missing services: ${missingServices.join(', ')}`
      });
    }
    
    // Basic formula validation - check if all services in formula are in dependent_services
    let formulaValid = true;
    let message = 'Formula is valid';
    
    // Extract service names from formula (basic regex)
    const formulaServices = formula.match(/[A-Za-z\s&]+(?=\s*[+\-*/()]|$)/g) || [];
    const cleanedFormulaServices = formulaServices
      .map(s => s.trim())
      .filter(s => s && !['', '100'].includes(s));
    
    const undeclaredServices = cleanedFormulaServices.filter(s => !serviceNames.includes(s));
    
    if (undeclaredServices.length > 0) {
      formulaValid = false;
      message = `Services used in formula but not declared: ${undeclaredServices.join(', ')}`;
    }
    
    res.json({
      valid: formulaValid,
      message: message
    });
  } catch (error) {
    console.error('Error validating formula:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT rename category
router.put('/categories/rename', async (req, res) => {
  try {
    const { oldCategory, newCategory } = req.body;
    
    if (!oldCategory || !newCategory) {
      return res.status(400).json({ message: 'Both old and new category names are required' });
    }
    
    // Check if new category name already exists
    const existingCheck = await pool.query(
      'SELECT COUNT(DISTINCT service_category) FROM service_catalog WHERE service_category = $1',
      [newCategory]
    );
    
    if (parseInt(existingCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'A category with this name already exists' });
    }
    
    // Update all services in the old category to the new category name
    const result = await pool.query(
      'UPDATE service_catalog SET service_category = $1 WHERE service_category = $2 RETURNING *',
      [newCategory, oldCategory]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ 
      message: `Successfully renamed category from "${oldCategory}" to "${newCategory}"`,
      updatedCount: result.rows.length 
    });
  } catch (error) {
    console.error('Error renaming category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT merge categories
router.put('/categories/merge', async (req, res) => {
  try {
    const { sourceCategory, targetCategory } = req.body;
    
    if (!sourceCategory || !targetCategory) {
      return res.status(400).json({ message: 'Both source and target categories are required' });
    }
    
    if (sourceCategory === targetCategory) {
      return res.status(400).json({ message: 'Cannot merge a category with itself' });
    }
    
    // Check if both categories exist
    const categoryCheck = await pool.query(
      'SELECT DISTINCT service_category FROM service_catalog WHERE service_category IN ($1, $2)',
      [sourceCategory, targetCategory]
    );
    
    if (categoryCheck.rows.length < 2) {
      return res.status(404).json({ message: 'One or both categories not found' });
    }
    
    // Update all services from source category to target category
    const result = await pool.query(
      'UPDATE service_catalog SET service_category = $1 WHERE service_category = $2 RETURNING *',
      [targetCategory, sourceCategory]
    );
    
    res.json({ 
      message: `Successfully merged "${sourceCategory}" into "${targetCategory}"`,
      updatedCount: result.rows.length 
    });
  } catch (error) {
    console.error('Error merging categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;