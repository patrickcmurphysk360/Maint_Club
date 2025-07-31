const express = require('express');
const router = express.Router();

// GET /api/scorecard-templates - Get all templates or template for specific market
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { market_id } = req.query;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'market_manager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
      SELECT 
        st.id,
        st.market_id,
        st.template_name,
        st.is_default,
        st.created_at,
        st.updated_at,
        m.name as market_name
      FROM scorecard_templates st
      LEFT JOIN markets m ON st.market_id = m.id
    `;
    
    const params = [];
    
    if (market_id) {
      query += ' WHERE st.market_id = $1 OR (st.market_id IS NULL AND st.is_default = true)';
      params.push(market_id);
    }
    
    query += ' ORDER BY st.is_default DESC, m.name, st.template_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scorecard templates:', error);
    res.status(500).json({ error: 'Failed to fetch scorecard templates' });
  }
});

// GET /api/scorecard-templates/available-fields - Get all available KPIs and services from service catalog
router.get('/available-fields', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Get all active services from service_catalog, organized by type
    // Core Metrics will be treated as KPIs
    const kpisQuery = `
      SELECT 
        LOWER(REPLACE(service_name, ' ', '')) as key,
        service_name as label,
        CASE 
          WHEN unit_type = 'currency' THEN 'currency'
          WHEN unit_type = 'percentage' THEN 'percentage'
          ELSE 'number'
        END as format,
        service_category as category,
        description,
        is_calculated,
        calculation_formula
      FROM service_catalog
      WHERE active = true 
        AND service_category IN ('Core Metrics', 'Calculated KPIs')
      ORDER BY display_order, service_name
    `;
    
    const servicesQuery = `
      SELECT 
        LOWER(REPLACE(service_name, ' ', '')) as key,
        service_name as label,
        service_category as category,
        CASE 
          WHEN unit_type = 'currency' THEN 'currency'
          WHEN unit_type = 'percentage' THEN 'percentage'
          ELSE 'number'
        END as format,
        description,
        is_calculated,
        calculation_formula,
        unit_type
      FROM service_catalog
      WHERE active = true 
        AND service_category NOT IN ('Core Metrics', 'Calculated KPIs')
      ORDER BY service_category, display_order, service_name
    `;
    
    // Get available categories for the template editor
    const categoriesQuery = `
      SELECT 
        service_category,
        COUNT(*) as service_count
      FROM service_catalog
      WHERE active = true
      GROUP BY service_category
      ORDER BY 
        CASE 
          WHEN service_category = 'Core Metrics' THEN 1
          WHEN service_category = 'Calculated KPIs' THEN 2
          ELSE 3
        END,
        service_category
    `;
    
    const [kpisResult, servicesResult, categoriesResult] = await Promise.all([
      pool.query(kpisQuery),
      pool.query(servicesQuery),
      pool.query(categoriesQuery)
    ]);
    
    const availableFields = {
      kpis: kpisResult.rows || [],
      services: servicesResult.rows || [],
      categories: categoriesResult.rows || []
    };
    
    console.log('Available fields response:', {
      kpisCount: availableFields.kpis.length,
      servicesCount: availableFields.services.length,
      categoriesCount: availableFields.categories.length
    });
    
    res.json(availableFields);
  } catch (error) {
    console.error('Error fetching available fields from service catalog:', error);
    res.status(500).json({ error: 'Failed to fetch available fields' });
  }
});

// GET /api/scorecard-templates/:id - Get template with categories and fields
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { id } = req.params;
    
    // Check permissions
    if (!['admin', 'administrator', 'marketManager', 'market_manager'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get template details
    const templateQuery = `
      SELECT 
        st.id,
        st.market_id,
        st.template_name,
        st.is_default,
        st.created_at,
        st.updated_at,
        m.name as market_name
      FROM scorecard_templates st
      LEFT JOIN markets m ON st.market_id = m.id
      WHERE st.id = $1
    `;
    
    const templateResult = await pool.query(templateQuery, [id]);
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const template = templateResult.rows[0];
    
    // Get categories with fields
    const categoriesQuery = `
      SELECT 
        stc.id,
        stc.category_name,
        stc.category_icon,
        stc.category_color,
        stc.display_order,
        stc.is_enabled,
        COALESCE(
          json_agg(
            json_build_object(
              'id', stf.id,
              'field_key', stf.field_key,
              'field_label', stf.field_label,
              'field_type', stf.field_type,
              'field_format', stf.field_format,
              'display_order', stf.display_order,
              'is_enabled', stf.is_enabled,
              'show_goal', stf.show_goal
            ) ORDER BY stf.display_order, stf.field_label
          ) FILTER (WHERE stf.id IS NOT NULL),
          '[]'::json
        ) as fields
      FROM scorecard_template_categories stc
      LEFT JOIN scorecard_template_fields stf ON stc.id = stf.category_id
      WHERE stc.template_id = $1
      GROUP BY stc.id, stc.category_name, stc.category_icon, stc.category_color, stc.display_order, stc.is_enabled
      ORDER BY stc.display_order, stc.category_name
    `;
    
    const categoriesResult = await pool.query(categoriesQuery, [id]);
    
    template.categories = categoriesResult.rows;
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching scorecard template:', error);
    res.status(500).json({ error: 'Failed to fetch scorecard template' });
  }
});

// GET /api/scorecard-templates/market/:marketId - Get template for specific market (or default)
router.get('/market/:marketId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { marketId } = req.params;
    
    // First try to get market-specific template
    let templateQuery = `
      SELECT 
        st.id,
        st.market_id,
        st.template_name,
        st.is_default,
        st.created_at,
        st.updated_at,
        m.name as market_name
      FROM scorecard_templates st
      LEFT JOIN markets m ON st.market_id = m.id
      WHERE st.market_id = $1
    `;
    
    let templateResult = await pool.query(templateQuery, [marketId]);
    
    // If no market-specific template, get default
    if (templateResult.rows.length === 0) {
      templateQuery = `
        SELECT 
          st.id,
          st.market_id,
          st.template_name,
          st.is_default,
          st.created_at,
          st.updated_at,
          NULL as market_name
        FROM scorecard_templates st
        WHERE st.is_default = true
      `;
      
      templateResult = await pool.query(templateQuery);
    }
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'No template found' });
    }
    
    const template = templateResult.rows[0];
    
    // Get categories with fields
    const categoriesQuery = `
      SELECT 
        stc.id,
        stc.category_name,
        stc.category_icon,
        stc.category_color,
        stc.display_order,
        stc.is_enabled,
        COALESCE(
          json_agg(
            json_build_object(
              'id', stf.id,
              'field_key', stf.field_key,
              'field_label', stf.field_label,
              'field_type', stf.field_type,
              'field_format', stf.field_format,
              'display_order', stf.display_order,
              'is_enabled', stf.is_enabled,
              'show_goal', stf.show_goal
            ) ORDER BY stf.display_order, stf.field_label
          ) FILTER (WHERE stf.id IS NOT NULL),
          '[]'::json
        ) as fields
      FROM scorecard_template_categories stc
      LEFT JOIN scorecard_template_fields stf ON stc.id = stf.category_id AND stf.is_enabled = true
      WHERE stc.template_id = $1 AND stc.is_enabled = true
      GROUP BY stc.id, stc.category_name, stc.category_icon, stc.category_color, stc.display_order, stc.is_enabled
      ORDER BY stc.display_order, stc.category_name
    `;
    
    const categoriesResult = await pool.query(categoriesQuery, [template.id]);
    
    template.categories = categoriesResult.rows;
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching market scorecard template:', error);
    res.status(500).json({ error: 'Failed to fetch market scorecard template' });
  }
});

// POST /api/scorecard-templates - Create new template (copy from default or another template)
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { market_id, template_name, copy_from_template_id } = req.body;
    
    // Check permissions - only admin can create templates
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!market_id || !template_name) {
      return res.status(400).json({ error: 'Market ID and template name are required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if market already has a template
      const existingCheck = await client.query(
        'SELECT id FROM scorecard_templates WHERE market_id = $1',
        [market_id]
      );
      
      if (existingCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Market already has a scorecard template' });
      }
      
      // Create new template
      const templateResult = await client.query(`
        INSERT INTO scorecard_templates (market_id, template_name, created_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [market_id, template_name, req.user.id]);
      
      const newTemplate = templateResult.rows[0];
      
      // Get source template (default if not specified)
      const sourceTemplateId = copy_from_template_id || (
        await client.query('SELECT id FROM scorecard_templates WHERE is_default = true')
      ).rows[0].id;
      
      // Copy categories
      const categoriesResult = await client.query(`
        INSERT INTO scorecard_template_categories 
        (template_id, category_name, category_icon, category_color, display_order, is_enabled)
        SELECT $1, category_name, category_icon, category_color, display_order, is_enabled
        FROM scorecard_template_categories
        WHERE template_id = $2
        RETURNING *
      `, [newTemplate.id, sourceTemplateId]);
      
      // Copy fields for each category
      for (const category of categoriesResult.rows) {
        await client.query(`
          INSERT INTO scorecard_template_fields 
          (category_id, field_key, field_label, field_type, field_format, display_order, is_enabled, show_goal)
          SELECT $1, stf.field_key, stf.field_label, stf.field_type, stf.field_format, stf.display_order, stf.is_enabled, stf.show_goal
          FROM scorecard_template_fields stf
          JOIN scorecard_template_categories stc ON stf.category_id = stc.id
          WHERE stc.template_id = $2 AND stc.category_name = $3
        `, [category.id, sourceTemplateId, category.category_name]);
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        id: newTemplate.id,
        market_id: newTemplate.market_id,
        template_name: newTemplate.template_name,
        message: 'Scorecard template created successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating scorecard template:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Template with this configuration already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create scorecard template' });
  }
});

// PUT /api/scorecard-templates/:id - Update template structure
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { id } = req.params;
    const { template_name, categories } = req.body;
    
    // Log incoming request for debugging
    console.log('📥 Template update request:', { 
      templateId: id, 
      template_name, 
      categoriesProvided: !!categories,
      categoriesCount: categories?.length 
    });
    
    // Check permissions
    console.log('🔐 Permission check for template update - User role:', role);
    if (!['admin', 'administrator', 'marketManager', 'market_manager'].includes(role)) {
      console.log('❌ Access denied for role:', role);
      return res.status(403).json({ message: 'Access denied - insufficient permissions for template editing' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('📝 Updating scorecard template:', { id, template_name, categoriesCount: categories?.length });
      
      // Update template name if provided
      if (template_name) {
        console.log('📝 Updating template name to:', template_name);
        await client.query(
          'UPDATE scorecard_templates SET template_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [template_name, id]
        );
      }
      
      // Update categories if provided
      if (categories && Array.isArray(categories)) {
        // Get existing categories for this template to handle deletions
        const existingCategoriesResult = await client.query(
          'SELECT id FROM scorecard_template_categories WHERE template_id = $1',
          [id]
        );
        const existingCategoryIds = existingCategoriesResult.rows.map(row => row.id);
        const providedCategoryIds = categories.filter(cat => cat.id).map(cat => cat.id);
        
        // Delete categories that are no longer in the provided list
        const categoryIdsToDelete = existingCategoryIds.filter(existingId => !providedCategoryIds.includes(existingId));
        for (const categoryIdToDelete of categoryIdsToDelete) {
          // Delete fields first (foreign key constraint)
          await client.query('DELETE FROM scorecard_template_fields WHERE category_id = $1', [categoryIdToDelete]);
          // Then delete category
          await client.query('DELETE FROM scorecard_template_categories WHERE id = $1', [categoryIdToDelete]);
        }
        
        for (const category of categories) {
          let categoryId = category.id;
          
          if (category.id) {
            // Update existing category
            await client.query(`
              UPDATE scorecard_template_categories 
              SET category_name = $1, category_icon = $2, category_color = $3, 
                  display_order = $4, is_enabled = $5, updated_at = CURRENT_TIMESTAMP
              WHERE id = $6 AND template_id = $7
            `, [
              category.category_name,
              category.category_icon,
              category.category_color,
              category.display_order,
              category.is_enabled,
              category.id,
              id
            ]);
          } else {
            // Create new category
            const newCategoryResult = await client.query(`
              INSERT INTO scorecard_template_categories 
              (template_id, category_name, category_icon, category_color, display_order, is_enabled, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING id
            `, [
              id,
              category.category_name,
              category.category_icon,
              category.category_color,
              category.display_order,
              category.is_enabled
            ]);
            categoryId = newCategoryResult.rows[0].id;
          }
          
          // Handle fields for this category
          if (category.fields && Array.isArray(category.fields)) {
            // Get existing fields for this category to handle deletions
            const existingFieldsResult = await client.query(
              'SELECT id FROM scorecard_template_fields WHERE category_id = $1',
              [categoryId]
            );
            const existingFieldIds = existingFieldsResult.rows.map(row => row.id);
            const providedFieldIds = category.fields.filter(field => field.id).map(field => field.id);
            
            // Delete fields that are no longer in the provided list
            const fieldIdsToDelete = existingFieldIds.filter(existingId => !providedFieldIds.includes(existingId));
            for (const fieldIdToDelete of fieldIdsToDelete) {
              await client.query('DELETE FROM scorecard_template_fields WHERE id = $1', [fieldIdToDelete]);
            }
            
            for (const field of category.fields) {
              if (field.id) {
                // Update existing field
                await client.query(`
                  UPDATE scorecard_template_fields 
                  SET field_label = $1, field_format = $2, display_order = $3, 
                      is_enabled = $4, show_goal = $5, updated_at = CURRENT_TIMESTAMP
                  WHERE id = $6 AND category_id = $7
                `, [
                  field.field_label,
                  field.field_format,
                  field.display_order,
                  field.is_enabled,
                  field.show_goal,
                  field.id,
                  categoryId
                ]);
              } else {
                // Create new field
                await client.query(`
                  INSERT INTO scorecard_template_fields 
                  (category_id, field_key, field_label, field_type, field_format, display_order, is_enabled, show_goal, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [
                  categoryId,
                  field.field_key,
                  field.field_label,
                  field.field_type,
                  field.field_format,
                  field.display_order,
                  field.is_enabled,
                  field.show_goal
                ]);
              }
            }
          }
        }
      }
      
      await client.query('COMMIT');
      
      res.json({ message: 'Scorecard template updated successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating scorecard template:', error);
    res.status(500).json({ error: 'Failed to update scorecard template' });
  }
});

// DELETE /api/scorecard-templates/:id - Delete template (only custom templates)
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.user;
    const { id } = req.params;
    
    // Check permissions
    if (!['admin', 'administrator'].includes(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Cannot delete default template
    const checkResult = await pool.query(
      'SELECT is_default FROM scorecard_templates WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (checkResult.rows[0].is_default) {
      return res.status(400).json({ error: 'Cannot delete default template' });
    }
    
    const result = await pool.query(
      'DELETE FROM scorecard_templates WHERE id = $1 RETURNING *',
      [id]
    );
    
    res.json({ message: 'Scorecard template deleted successfully' });
  } catch (error) {
    console.error('Error deleting scorecard template:', error);
    res.status(500).json({ error: 'Failed to delete scorecard template' });
  }
});

module.exports = router;