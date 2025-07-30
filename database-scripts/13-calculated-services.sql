-- Add fields to service_catalog for calculated services
ALTER TABLE service_catalog
ADD COLUMN IF NOT EXISTS is_calculated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS calculation_formula TEXT,
ADD COLUMN IF NOT EXISTS calculation_type VARCHAR(50) CHECK (calculation_type IN ('percentage', 'ratio', 'sum', 'difference', 'average', 'custom')),
ADD COLUMN IF NOT EXISTS dependent_services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS unit_type VARCHAR(50) DEFAULT 'count';

-- Create table for storing calculation dependencies
CREATE TABLE IF NOT EXISTS service_calculation_dependencies (
    id SERIAL PRIMARY KEY,
    calculated_service_id INTEGER NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
    dependent_service_id INTEGER NOT NULL REFERENCES service_catalog(id),
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('add', 'subtract', 'multiply', 'divide')),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(calculated_service_id, dependent_service_id)
);

-- Add some example calculated services
INSERT INTO service_catalog (service_name, service_category, display_order, description, is_calculated, calculation_type, calculation_formula, dependent_services, unit_type)
VALUES 
('Oil Change Penetration %', 'Calculated KPIs', 200, 'Percentage of invoices with oil changes', true, 'percentage', 
 '(Oil Change + Premium Oil Change + Synthetic Oil Change + Synthetic Blend Oil Change) / Invoices * 100',
 '["Oil Change", "Premium Oil Change", "Synthetic Oil Change", "Synthetic Blend Oil Change", "Invoices"]'::jsonb, 'percentage'),

('Average Ticket Size', 'Calculated KPIs', 201, 'Average sales per invoice', true, 'ratio',
 'Sales / Invoices',
 '["Sales", "Invoices"]'::jsonb, 'currency'),

('Filter Attachment Rate', 'Calculated KPIs', 202, 'Percentage of oil changes with filter sales', true, 'percentage',
 '(Engine Air Filter + Cabin Air Filter) / (Oil Change + Premium Oil Change + Synthetic Oil Change + Synthetic Blend Oil Change) * 100',
 '["Engine Air Filter", "Cabin Air Filter", "Oil Change", "Premium Oil Change", "Synthetic Oil Change", "Synthetic Blend Oil Change"]'::jsonb, 'percentage'),

('Total Fluid Services', 'Calculated KPIs', 203, 'Sum of all fluid service sales', true, 'sum',
 'Coolant Flush + Power Steering Flush + Transmission Fluid Service + Differential Service + Transfer Case Service + Brake Flush',
 '["Coolant Flush", "Power Steering Flush", "Transmission Fluid Service", "Differential Service", "Transfer Case Service", "Brake Flush"]'::jsonb, 'count')

ON CONFLICT (service_name) DO UPDATE
SET is_calculated = EXCLUDED.is_calculated,
    calculation_type = EXCLUDED.calculation_type,
    calculation_formula = EXCLUDED.calculation_formula,
    dependent_services = EXCLUDED.dependent_services,
    unit_type = EXCLUDED.unit_type;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_catalog_is_calculated ON service_catalog(is_calculated);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(service_category);

-- Function to validate calculation formula
CREATE OR REPLACE FUNCTION validate_calculation_formula()
RETURNS TRIGGER AS $$
DECLARE
    service_name TEXT;
    dependent_service JSONB;
BEGIN
    -- Only validate if it's a calculated service
    IF NEW.is_calculated = TRUE THEN
        -- Check that all dependent services exist
        FOR dependent_service IN SELECT jsonb_array_elements(NEW.dependent_services)
        LOOP
            service_name := dependent_service::TEXT;
            service_name := TRIM(BOTH '"' FROM service_name);
            
            IF NOT EXISTS (
                SELECT 1 FROM service_catalog 
                WHERE service_catalog.service_name = service_name
                AND service_catalog.id != NEW.id
            ) THEN
                RAISE EXCEPTION 'Dependent service % does not exist', service_name;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_calculation_formula_trigger ON service_catalog;
CREATE TRIGGER validate_calculation_formula_trigger
BEFORE INSERT OR UPDATE ON service_catalog
FOR EACH ROW
EXECUTE FUNCTION validate_calculation_formula();