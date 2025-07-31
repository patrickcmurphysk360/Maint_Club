-- Scorecard Templates System
-- Allows markets to customize which services/KPIs are displayed in advisor scorecards

-- Scorecard templates (one per market, with default template)
CREATE TABLE IF NOT EXISTS scorecard_templates (
    id SERIAL PRIMARY KEY,
    market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one default template
    CONSTRAINT unique_default_template CHECK (
        (is_default = false) OR 
        (is_default = true AND market_id IS NULL)
    ),
    
    -- Ensure unique template per market
    CONSTRAINT unique_market_template UNIQUE (market_id)
);

-- Template categories (customizable categories for each template)
CREATE TABLE IF NOT EXISTS scorecard_template_categories (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES scorecard_templates(id) ON DELETE CASCADE,
    category_name VARCHAR(255) NOT NULL,
    category_icon VARCHAR(50) DEFAULT '📊',
    category_color VARCHAR(50) DEFAULT 'blue',
    display_order INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_category_per_template UNIQUE (template_id, category_name)
);

-- Template category fields (which KPIs/services are shown in each category)
CREATE TABLE IF NOT EXISTS scorecard_template_fields (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES scorecard_template_categories(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL, -- e.g., 'totalSales', 'premiumOilChange'
    field_label VARCHAR(255) NOT NULL, -- Display name
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('kpi', 'service')),
    field_format VARCHAR(50) DEFAULT 'number' CHECK (field_format IN ('currency', 'percentage', 'number')),
    display_order INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    show_goal BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_field_per_category UNIQUE (category_id, field_key)
);

-- Insert default template
INSERT INTO scorecard_templates (template_name, is_default, created_at) 
VALUES ('Default Scorecard Template', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Get the default template ID
DO $$
DECLARE
    default_template_id INTEGER;
    core_category_id INTEGER;
    oil_category_id INTEGER;
    brake_category_id INTEGER;
    engine_category_id INTEGER;
    climate_category_id INTEGER;
    maintenance_category_id INTEGER;
BEGIN
    -- Get default template ID
    SELECT id INTO default_template_id 
    FROM scorecard_templates 
    WHERE is_default = true;
    
    -- Insert default categories
    INSERT INTO scorecard_template_categories (template_id, category_name, category_icon, category_color, display_order) VALUES
    (default_template_id, 'Core KPIs', '📊', 'blue', 1),
    (default_template_id, 'Oil & Fluid Services', '🛢️', 'amber', 2),
    (default_template_id, 'Brake & Suspension', '🔧', 'red', 3),
    (default_template_id, 'Engine & Performance', '⚙️', 'green', 4),
    (default_template_id, 'Climate & Electrical', '🔋', 'purple', 5),
    (default_template_id, 'Maintenance & Inspection', '🔍', 'gray', 6)
    ON CONFLICT DO NOTHING;
    
    -- Get category IDs
    SELECT id INTO core_category_id FROM scorecard_template_categories WHERE template_id = default_template_id AND category_name = 'Core KPIs';
    SELECT id INTO oil_category_id FROM scorecard_template_categories WHERE template_id = default_template_id AND category_name = 'Oil & Fluid Services';
    SELECT id INTO brake_category_id FROM scorecard_template_categories WHERE template_id = default_template_id AND category_name = 'Brake & Suspension';
    SELECT id INTO engine_category_id FROM scorecard_template_categories WHERE template_id = default_template_id AND category_name = 'Engine & Performance';
    SELECT id INTO climate_category_id FROM scorecard_template_categories WHERE template_id = default_template_id AND category_name = 'Climate & Electrical';
    SELECT id INTO maintenance_category_id FROM scorecard_template_categories WHERE template_id = default_template_id AND category_name = 'Maintenance & Inspection';
    
    -- Insert Core KPIs
    INSERT INTO scorecard_template_fields (category_id, field_key, field_label, field_type, field_format, display_order) VALUES
    (core_category_id, 'totalSales', 'Total Sales', 'kpi', 'currency', 1),
    (core_category_id, 'salesPerVehicle', 'Sales per Vehicle', 'kpi', 'currency', 2),
    (core_category_id, 'grossProfit', 'Gross Profit', 'kpi', 'currency', 3),
    (core_category_id, 'grossProfitPercent', 'Gross Profit %', 'kpi', 'percentage', 4),
    (core_category_id, 'customerCount', 'Customer Count', 'kpi', 'number', 5)
    ON CONFLICT DO NOTHING;
    
    -- Insert Oil & Fluid Services
    INSERT INTO scorecard_template_fields (category_id, field_key, field_label, field_type, field_format, display_order) VALUES
    (oil_category_id, 'oilChange', 'Oil Change', 'service', 'number', 1),
    (oil_category_id, 'premiumOilChange', 'Premium Oil Change', 'service', 'number', 2),
    (oil_category_id, 'coolantFlush', 'Coolant Flush', 'service', 'number', 3),
    (oil_category_id, 'brakeFlush', 'Brake Flush', 'service', 'number', 4),
    (oil_category_id, 'transmissionFluidService', 'Transmission Fluid Service', 'service', 'number', 5),
    (oil_category_id, 'powerSteeringFlush', 'Power Steering Flush', 'service', 'number', 6)
    ON CONFLICT DO NOTHING;
    
    -- Insert Brake & Suspension
    INSERT INTO scorecard_template_fields (category_id, field_key, field_label, field_type, field_format, display_order) VALUES
    (brake_category_id, 'brakeService', 'Brake Service', 'service', 'number', 1),
    (brake_category_id, 'shocksStruts', 'Shocks & Struts', 'service', 'number', 2)
    ON CONFLICT DO NOTHING;
    
    -- Insert Engine & Performance
    INSERT INTO scorecard_template_fields (category_id, field_key, field_label, field_type, field_format, display_order) VALUES
    (engine_category_id, 'engineAirFilter', 'Engine Air Filter', 'service', 'number', 1),
    (engine_category_id, 'fuelAdditive', 'Fuel Additive', 'service', 'number', 2),
    (engine_category_id, 'engineFlush', 'Engine Flush', 'service', 'number', 3),
    (engine_category_id, 'alignment', 'Alignments', 'service', 'number', 4)
    ON CONFLICT DO NOTHING;
    
    -- Insert Climate & Electrical
    INSERT INTO scorecard_template_fields (category_id, field_key, field_label, field_type, field_format, display_order) VALUES
    (climate_category_id, 'battery', 'Battery', 'service', 'number', 1),
    (climate_category_id, 'cabinAirFilter', 'Cabin Air Filter', 'service', 'number', 2),
    (climate_category_id, 'acService', 'AC Service', 'service', 'number', 3)
    ON CONFLICT DO NOTHING;
    
    -- Insert Maintenance & Inspection
    INSERT INTO scorecard_template_fields (category_id, field_key, field_label, field_type, field_format, display_order) VALUES
    (maintenance_category_id, 'wiperBlades', 'Wiper Blades', 'service', 'number', 1),
    (maintenance_category_id, 'tireRotation', 'Tire Rotation', 'service', 'number', 2)
    ON CONFLICT DO NOTHING;
    
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_market ON scorecard_templates(market_id);
CREATE INDEX IF NOT EXISTS idx_template_categories_template ON scorecard_template_categories(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_category ON scorecard_template_fields(category_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_enabled ON scorecard_template_fields(is_enabled, display_order);