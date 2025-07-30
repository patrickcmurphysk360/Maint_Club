-- Vendor Product Mappings Table
CREATE TABLE IF NOT EXISTS vendor_mappings (
    id SERIAL PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    vendor VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    UNIQUE(market_id, vendor)
);

-- Vendor Mapping Details Table
CREATE TABLE IF NOT EXISTS vendor_mapping_details (
    id SERIAL PRIMARY KEY,
    mapping_id INTEGER REFERENCES vendor_mappings(id) ON DELETE CASCADE,
    generic_service VARCHAR(255) NOT NULL,
    branded_service VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mapping_id, generic_service)
);

-- Create indexes for performance
CREATE INDEX idx_vendor_mappings_market_id ON vendor_mappings(market_id);
CREATE INDEX idx_vendor_mappings_vendor ON vendor_mappings(vendor);
CREATE INDEX idx_vendor_mapping_details_mapping_id ON vendor_mapping_details(mapping_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vendor_mappings_updated_at BEFORE UPDATE
    ON vendor_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();