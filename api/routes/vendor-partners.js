const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all vendor partners with optional filtering
router.get('/', async (req, res) => {
    try {
        const { active, search } = req.query;
        
        let query = `
            SELECT 
                vp.*,
                COUNT(DISTINCT vpr.id) as product_count,
                COUNT(DISTINCT vm.id) as mapping_count
            FROM vendor_partners vp
            LEFT JOIN vendor_products vpr ON vp.id = vpr.vendor_id
            LEFT JOIN vendor_mappings vm ON vp.id = vm.vendor_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (active !== undefined) {
            params.push(active === 'true');
            query += ` AND vp.active = $${params.length}`;
        }
        
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (vp.vendor_name ILIKE $${params.length} OR vp.vendor_tag ILIKE $${params.length})`;
        }
        
        query += ' GROUP BY vp.id ORDER BY vp.vendor_name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vendor partners:', error);
        res.status(500).json({ error: 'Failed to fetch vendor partners' });
    }
});

// Get single vendor partner by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const vendorQuery = `
            SELECT 
                vp.*,
                COUNT(DISTINCT vpr.id) as product_count,
                COUNT(DISTINCT vm.id) as mapping_count
            FROM vendor_partners vp
            LEFT JOIN vendor_products vpr ON vp.id = vpr.vendor_id
            LEFT JOIN vendor_mappings vm ON vp.id = vm.vendor_id
            WHERE vp.id = $1
            GROUP BY vp.id
        `;
        
        const vendorResult = await pool.query(vendorQuery, [id]);
        
        if (vendorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor partner not found' });
        }
        
        // Get products for this vendor
        const productsQuery = `
            SELECT * FROM vendor_products 
            WHERE vendor_id = $1 
            ORDER BY product_category, branded_product_name
        `;
        
        const productsResult = await pool.query(productsQuery, [id]);
        
        const vendor = vendorResult.rows[0];
        vendor.products = productsResult.rows;
        
        res.json(vendor);
    } catch (error) {
        console.error('Error fetching vendor partner:', error);
        res.status(500).json({ error: 'Failed to fetch vendor partner' });
    }
});

// Create new vendor partner
router.post('/', async (req, res) => {
    const {
        vendor_name,
        vendor_tag,
        address,
        city,
        state,
        zip,
        phone,
        email,
        website,
        notes,
        created_by
    } = req.body;
    
    if (!vendor_name || !vendor_tag) {
        return res.status(400).json({ 
            error: 'vendor_name and vendor_tag are required' 
        });
    }
    
    try {
        // Handle both integer and string user IDs (Phase 1 users have string IDs)
        const createdByValue = created_by && typeof created_by === 'number' ? created_by : null;
        
        const result = await pool.query(
            `INSERT INTO vendor_partners 
             (vendor_name, vendor_tag, address, city, state, zip, phone, email, website, notes, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING *`,
            [vendor_name, vendor_tag.toLowerCase(), address, city, state, zip, phone, email, website, notes, createdByValue]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
                error: 'Vendor tag already exists' 
            });
        }
        
        console.error('Error creating vendor partner:', error);
        res.status(500).json({ error: 'Failed to create vendor partner' });
    }
});

// Update vendor partner
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        vendor_name,
        vendor_tag,
        address,
        city,
        state,
        zip,
        phone,
        email,
        website,
        notes,
        active
    } = req.body;
    
    if (!vendor_name || !vendor_tag) {
        return res.status(400).json({ 
            error: 'vendor_name and vendor_tag are required' 
        });
    }
    
    try {
        const result = await pool.query(
            `UPDATE vendor_partners 
             SET vendor_name = $1, vendor_tag = $2, address = $3, city = $4, 
                 state = $5, zip = $6, phone = $7, email = $8, website = $9, 
                 notes = $10, active = $11, updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
             RETURNING *`,
            [vendor_name, vendor_tag.toLowerCase(), address, city, state, zip, 
             phone, email, website, notes, active !== undefined ? active : true, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor partner not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
                error: 'Vendor tag already exists' 
            });
        }
        
        console.error('Error updating vendor partner:', error);
        res.status(500).json({ error: 'Failed to update vendor partner' });
    }
});

// Delete vendor partner
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if vendor has mappings
        const mappingsCheck = await pool.query(
            'SELECT COUNT(*) FROM vendor_mappings WHERE vendor_id = $1',
            [id]
        );
        
        if (parseInt(mappingsCheck.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete vendor with existing market mappings. Please remove mappings first.' 
            });
        }
        
        const result = await pool.query(
            'DELETE FROM vendor_partners WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor partner not found' });
        }
        
        res.json({ message: 'Vendor partner deleted successfully' });
    } catch (error) {
        console.error('Error deleting vendor partner:', error);
        res.status(500).json({ error: 'Failed to delete vendor partner' });
    }
});

// Toggle vendor active status
router.patch('/:id/toggle-active', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            `UPDATE vendor_partners 
             SET active = NOT active, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor partner not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error toggling vendor status:', error);
        res.status(500).json({ error: 'Failed to toggle vendor status' });
    }
});

// Vendor Products Endpoints

// Get all products for a vendor
router.get('/:vendorId/products', async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { active } = req.query;
        
        let query = `
            SELECT * FROM vendor_products 
            WHERE vendor_id = $1
        `;
        
        const params = [vendorId];
        
        if (active !== undefined) {
            params.push(active === 'true');
            query += ` AND active = $${params.length}`;
        }
        
        query += ' ORDER BY product_category, branded_product_name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vendor products:', error);
        res.status(500).json({ error: 'Failed to fetch vendor products' });
    }
});

// Create new vendor product
router.post('/:vendorId/products', async (req, res) => {
    const { vendorId } = req.params;
    const {
        branded_product_name,
        product_category,
        product_sku,
        description,
        price
    } = req.body;
    
    if (!branded_product_name || !product_category) {
        return res.status(400).json({ 
            error: 'branded_product_name and product_category are required' 
        });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO vendor_products 
             (vendor_id, branded_product_name, product_category, product_sku, description, price) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [vendorId, branded_product_name, product_category, product_sku, description, price]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
                error: 'Product with this name already exists for this vendor' 
            });
        }
        
        console.error('Error creating vendor product:', error);
        res.status(500).json({ error: 'Failed to create vendor product' });
    }
});

// Update vendor product
router.put('/:vendorId/products/:productId', async (req, res) => {
    const { vendorId, productId } = req.params;
    const {
        branded_product_name,
        product_category,
        product_sku,
        description,
        price,
        active
    } = req.body;
    
    if (!branded_product_name || !product_category) {
        return res.status(400).json({ 
            error: 'branded_product_name and product_category are required' 
        });
    }
    
    try {
        const result = await pool.query(
            `UPDATE vendor_products 
             SET branded_product_name = $1, product_category = $2, product_sku = $3,
                 description = $4, price = $5, active = $6, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 AND vendor_id = $8
             RETURNING *`,
            [branded_product_name, product_category, product_sku, description, price, 
             active !== undefined ? active : true, productId, vendorId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor product not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
                error: 'Product with this name already exists for this vendor' 
            });
        }
        
        console.error('Error updating vendor product:', error);
        res.status(500).json({ error: 'Failed to update vendor product' });
    }
});

// Delete vendor product
router.delete('/:vendorId/products/:productId', async (req, res) => {
    try {
        const { vendorId, productId } = req.params;
        
        const result = await pool.query(
            'DELETE FROM vendor_products WHERE id = $1 AND vendor_id = $2 RETURNING *',
            [productId, vendorId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor product not found' });
        }
        
        res.json({ message: 'Vendor product deleted successfully' });
    } catch (error) {
        console.error('Error deleting vendor product:', error);
        res.status(500).json({ error: 'Failed to delete vendor product' });
    }
});

// Get product categories
router.get('/categories/list', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM product_categories ORDER BY display_order, category_name'
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching product categories:', error);
        res.status(500).json({ error: 'Failed to fetch product categories' });
    }
});

module.exports = router;