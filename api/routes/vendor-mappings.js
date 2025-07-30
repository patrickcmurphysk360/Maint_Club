const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get service mappings for a vendor (new simplified endpoint)
router.get('/', async (req, res) => {
    try {
        const { vendor_id } = req.query;
        
        if (vendor_id) {
            // New simplified query for individual service mappings
            const result = await pool.query(`
                SELECT 
                    vpm.id,
                    vpm.vendor_id,
                    vpm.service_field,
                    vpm.product_name,
                    vpm.vendor_product_id,
                    vpm.market_id,
                    vpm.description,
                    vpm.created_at,
                    vpm.updated_at
                FROM vendor_product_mappings vpm
                WHERE vpm.vendor_id = $1
                ORDER BY vpm.service_field
            `, [vendor_id]);
            
            return res.json({ mappings: result.rows });
        }
        
        // Original query for backward compatibility
        const { market_id, vendor } = req.query;
        
        let query = `
            SELECT 
                vm.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', vmd.id,
                            'generic_service', vmd.generic_service,
                            'branded_service', vmd.branded_service
                        ) 
                        ORDER BY vmd.generic_service
                    ) FILTER (WHERE vmd.id IS NOT NULL), 
                    '[]'
                ) as mappings
            FROM vendor_mappings vm
            LEFT JOIN vendor_mapping_details vmd ON vm.id = vmd.mapping_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (market_id) {
            params.push(market_id);
            query += ` AND vm.market_id = $${params.length}`;
        }
        
        if (vendor) {
            params.push(vendor);
            query += ` AND vm.vendor = $${params.length}`;
        }
        
        query += ' GROUP BY vm.id ORDER BY vm.market_id, vm.vendor';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vendor mappings:', error);
        res.status(500).json({ error: 'Failed to fetch vendor mappings' });
    }
});

// Get single vendor mapping by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                vm.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', vmd.id,
                            'generic_service', vmd.generic_service,
                            'branded_service', vmd.branded_service
                        ) 
                        ORDER BY vmd.generic_service
                    ) FILTER (WHERE vmd.id IS NOT NULL), 
                    '[]'
                ) as mappings
            FROM vendor_mappings vm
            LEFT JOIN vendor_mapping_details vmd ON vm.id = vmd.mapping_id
            WHERE vm.id = $1
            GROUP BY vm.id
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vendor mapping not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching vendor mapping:', error);
        res.status(500).json({ error: 'Failed to fetch vendor mapping' });
    }
});

// Create new individual service mapping (new endpoint)
router.post('/', async (req, res) => {
    const { vendor_id, service_field, product_name, vendor_product_id, market_id, description } = req.body;
    
    // Check if this is a new individual mapping request
    if (service_field && product_name && vendor_id && !req.body.mappings) {
        try {
            const result = await pool.query(`
                INSERT INTO vendor_product_mappings 
                (vendor_id, service_field, product_name, vendor_product_id, market_id, description)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [vendor_id, service_field, product_name, vendor_product_id, market_id, description]);
            
            return res.status(201).json(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({ 
                    error: 'Service mapping already exists for this vendor and service' 
                });
            }
            console.error('Error creating service mapping:', error);
            return res.status(500).json({ error: 'Failed to create service mapping' });
        }
    }
    
    // Original bulk mapping code for backward compatibility
    const { vendor, mappings, created_by } = req.body;
    
    if (!market_id || !vendor_id || !mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ 
            error: 'market_id, vendor_id, and mappings array are required' 
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Handle both integer and string user IDs (Phase 1 users have string IDs)
        const createdByValue = created_by && typeof created_by === 'number' ? created_by : null;
        
        // Insert vendor mapping
        const mappingResult = await client.query(
            `INSERT INTO vendor_mappings (market_id, vendor, vendor_id, created_by) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [market_id, vendor, vendor_id, createdByValue]
        );
        
        const mappingId = mappingResult.rows[0].id;
        
        // Insert mapping details
        for (const mapping of mappings) {
            if (mapping.generic_service && mapping.branded_service) {
                await client.query(
                    `INSERT INTO vendor_mapping_details 
                     (mapping_id, generic_service, branded_service) 
                     VALUES ($1, $2, $3)`,
                    [mappingId, mapping.generic_service, mapping.branded_service]
                );
            }
        }
        
        await client.query('COMMIT');
        
        // Fetch the complete mapping with details
        const completeMapping = await pool.query(
            `SELECT 
                vm.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', vmd.id,
                            'generic_service', vmd.generic_service,
                            'branded_service', vmd.branded_service
                        ) 
                        ORDER BY vmd.generic_service
                    ) FILTER (WHERE vmd.id IS NOT NULL), 
                    '[]'
                ) as mappings
            FROM vendor_mappings vm
            LEFT JOIN vendor_mapping_details vmd ON vm.id = vmd.mapping_id
            WHERE vm.id = $1
            GROUP BY vm.id`,
            [mappingId]
        );
        
        res.status(201).json(completeMapping.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
                error: 'Vendor mapping already exists for this market and vendor' 
            });
        }
        
        console.error('Error creating vendor mapping:', error);
        res.status(500).json({ error: 'Failed to create vendor mapping' });
    } finally {
        client.release();
    }
});

// Update individual service mapping or vendor mapping
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { vendor_id, service_field, product_name, vendor_product_id, market_id, description } = req.body;
    
    // Check if this is an individual mapping update
    if (service_field && product_name && vendor_id && !req.body.mappings) {
        try {
            const result = await pool.query(`
                UPDATE vendor_product_mappings 
                SET vendor_id = $1, service_field = $2, product_name = $3, 
                    vendor_product_id = $4, market_id = $5, description = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $7
                RETURNING *
            `, [vendor_id, service_field, product_name, vendor_product_id, market_id, description, id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Service mapping not found' });
            }
            
            return res.json(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({ 
                    error: 'Service mapping already exists for this vendor and service' 
                });
            }
            console.error('Error updating service mapping:', error);
            return res.status(500).json({ error: 'Failed to update service mapping' });
        }
    }
    
    // Original bulk mapping update for backward compatibility
    const { vendor, mappings } = req.body;
    
    if (!market_id || !vendor_id || !mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ 
            error: 'market_id, vendor_id, and mappings array are required' 
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Update vendor mapping
        const updateResult = await client.query(
            `UPDATE vendor_mappings 
             SET market_id = $1, vendor = $2, vendor_id = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [market_id, vendor, vendor_id, id]
        );
        
        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Vendor mapping not found' });
        }
        
        // Delete existing mapping details
        await client.query(
            'DELETE FROM vendor_mapping_details WHERE mapping_id = $1',
            [id]
        );
        
        // Insert new mapping details
        for (const mapping of mappings) {
            if (mapping.generic_service && mapping.branded_service) {
                await client.query(
                    `INSERT INTO vendor_mapping_details 
                     (mapping_id, generic_service, branded_service) 
                     VALUES ($1, $2, $3)`,
                    [id, mapping.generic_service, mapping.branded_service]
                );
            }
        }
        
        await client.query('COMMIT');
        
        // Fetch the complete updated mapping
        const completeMapping = await pool.query(
            `SELECT 
                vm.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', vmd.id,
                            'generic_service', vmd.generic_service,
                            'branded_service', vmd.branded_service
                        ) 
                        ORDER BY vmd.generic_service
                    ) FILTER (WHERE vmd.id IS NOT NULL), 
                    '[]'
                ) as mappings
            FROM vendor_mappings vm
            LEFT JOIN vendor_mapping_details vmd ON vm.id = vmd.mapping_id
            WHERE vm.id = $1
            GROUP BY vm.id`,
            [id]
        );
        
        res.json(completeMapping.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
                error: 'Vendor mapping already exists for this market and vendor' 
            });
        }
        
        console.error('Error updating vendor mapping:', error);
        res.status(500).json({ error: 'Failed to update vendor mapping' });
    } finally {
        client.release();
    }
});

// Delete vendor mapping or service mapping
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First try to delete from vendor_product_mappings
        const serviceMappingResult = await pool.query(
            'DELETE FROM vendor_product_mappings WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (serviceMappingResult.rows.length > 0) {
            return res.json({ message: 'Service mapping deleted successfully' });
        }
        
        // If not found, try original vendor_mappings table
        const result = await pool.query(
            'DELETE FROM vendor_mappings WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mapping not found' });
        }
        
        res.json({ message: 'Vendor mapping deleted successfully' });
    } catch (error) {
        console.error('Error deleting mapping:', error);
        res.status(500).json({ error: 'Failed to delete mapping' });
    }
});

// Get available vendors
router.get('/vendors/list', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT DISTINCT vendor FROM vendor_mappings ORDER BY vendor'
        );
        
        res.json(result.rows.map(row => row.vendor));
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

// Get vendor products for a specific vendor
router.get('/vendor-products/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        
        const result = await pool.query(
            `SELECT id, branded_product_name, product_category, product_sku 
             FROM vendor_products 
             WHERE vendor_id = $1 AND active = true
             ORDER BY product_category, branded_product_name`,
            [vendorId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vendor products:', error);
        res.status(500).json({ error: 'Failed to fetch vendor products' });
    }
});

// Get available generic services
router.get('/services/generic', async (req, res) => {
    try {
        // These are the standard services that can be mapped
        const genericServices = [
            'Premium Oil Change',
            'Fuel Additive', 
            'Engine Flush',
            'Alignments',
            'Brake Service',
            'Oil Change',
            'Transmission Service',
            'Coolant Service',
            'Air Filter',
            'Cabin Air Filter',
            'Battery Service',
            'Tire Rotation'
        ];
        
        res.json(genericServices);
    } catch (error) {
        console.error('Error fetching generic services:', error);
        res.status(500).json({ error: 'Failed to fetch generic services' });
    }
});

module.exports = router;