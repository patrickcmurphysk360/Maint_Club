-- Vendor Partners Table
CREATE TABLE IF NOT EXISTS vendor_partners (
    id SERIAL PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_tag VARCHAR(50) NOT NULL UNIQUE,
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Vendor Products Table
CREATE TABLE IF NOT EXISTS vendor_products (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendor_partners(id) ON DELETE CASCADE,
    branded_product_name VARCHAR(255) NOT NULL,
    product_category VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, branded_product_name)
);

-- Product Categories (as a reference/enum table)
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0
);

-- Insert default product categories
INSERT INTO product_categories (category_name, display_order) VALUES
    ('Oil & Lubricants', 1),
    ('Fuel System', 2),
    ('Engine Treatments', 3),
    ('Transmission', 4),
    ('Cooling System', 5),
    ('Brake System', 6),
    ('Power Steering', 7),
    ('Battery & Electrical', 8),
    ('Air Filters', 9),
    ('Other Services', 10)
ON CONFLICT (category_name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_vendor_partners_vendor_tag ON vendor_partners(vendor_tag);
CREATE INDEX idx_vendor_partners_active ON vendor_partners(active);
CREATE INDEX idx_vendor_products_vendor_id ON vendor_products(vendor_id);
CREATE INDEX idx_vendor_products_category ON vendor_products(product_category);
CREATE INDEX idx_vendor_products_active ON vendor_products(active);

-- Update trigger for updated_at
CREATE TRIGGER update_vendor_partners_updated_at BEFORE UPDATE
    ON vendor_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_products_updated_at BEFORE UPDATE
    ON vendor_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key to vendor_mappings to link with vendor_partners
ALTER TABLE vendor_mappings 
    ADD COLUMN vendor_id INTEGER REFERENCES vendor_partners(id);

-- Create a migration function to link existing vendor mappings
CREATE OR REPLACE FUNCTION migrate_vendor_mappings() RETURNS void AS $$
DECLARE
    mapping RECORD;
    partner_id INTEGER;
BEGIN
    FOR mapping IN SELECT DISTINCT vendor FROM vendor_mappings WHERE vendor_id IS NULL
    LOOP
        -- Check if vendor partner exists
        SELECT id INTO partner_id FROM vendor_partners WHERE vendor_name = mapping.vendor;
        
        -- If not, create it
        IF partner_id IS NULL THEN
            INSERT INTO vendor_partners (vendor_name, vendor_tag) 
            VALUES (mapping.vendor, LOWER(REPLACE(mapping.vendor, ' ', '_')))
            RETURNING id INTO partner_id;
        END IF;
        
        -- Update vendor mappings
        UPDATE vendor_mappings SET vendor_id = partner_id WHERE vendor = mapping.vendor;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration (commented out, run manually if needed)
-- SELECT migrate_vendor_mappings();