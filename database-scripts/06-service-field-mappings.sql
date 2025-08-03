-- Service Field Mappings System
-- Creates tables for flexible spreadsheet header to scorecard field mapping

-- Default field mappings (global defaults)
CREATE TABLE IF NOT EXISTS default_field_mappings (
  id SERIAL PRIMARY KEY,
  spreadsheet_header VARCHAR(255) NOT NULL,
  scorecard_field_key VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('direct', 'nested', 'calculated', 'percentage')),
  data_field_name VARCHAR(255),
  display_label VARCHAR(255) NOT NULL,
  is_percentage BOOLEAN DEFAULT FALSE,
  calculation_formula VARCHAR(500), -- For calculated fields like percentages
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(spreadsheet_header, scorecard_field_key)
);

-- Market-specific field mapping overrides
CREATE TABLE IF NOT EXISTS service_field_mappings (
  id SERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES markets(id),
  spreadsheet_header VARCHAR(255) NOT NULL,
  scorecard_field_key VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('direct', 'nested', 'calculated', 'percentage')),
  data_field_name VARCHAR(255),
  display_label VARCHAR(255) NOT NULL,
  is_percentage BOOLEAN DEFAULT FALSE,
  calculation_formula VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(market_id, spreadsheet_header, scorecard_field_key)
);

-- Spreadsheet header discovery log (tracks headers found in uploaded files)
CREATE TABLE IF NOT EXISTS discovered_spreadsheet_headers (
  id SERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES markets(id),
  spreadsheet_filename VARCHAR(500),
  header_name VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(100),
  column_position INTEGER,
  sample_values TEXT[], -- Array of sample values from this column
  is_mapped BOOLEAN DEFAULT FALSE,
  discovered_at TIMESTAMP DEFAULT NOW()
);

-- Insert default field mappings based on current hardcoded mappings
INSERT INTO default_field_mappings (spreadsheet_header, scorecard_field_key, field_type, data_field_name, display_label, is_percentage, sort_order) VALUES
-- Core metrics
('ID', 'storeid', 'direct', 'storeId', 'Store ID', FALSE, 1),
('Market', 'market', 'direct', 'market', 'Market', FALSE, 2),
('Store', 'storename', 'direct', 'storeName', 'Store Name', FALSE, 3),
('Employee', 'employeename', 'direct', 'employeeName', 'Employee Name', FALSE, 4),
('Sales', 'sales', 'calculated', 'sales', 'Sales', FALSE, 5),
('GP Sales', 'gpsales', 'calculated', 'gpSales', 'GP Sales', FALSE, 6),
('GP Percent', 'gppercent', 'percentage', 'gpPercent', 'GP Percent', TRUE, 7),
('Avg. Spend', 'avgspend', 'calculated', 'avgSpend', 'Avg. Spend', FALSE, 8),
('Invoices', 'invoices', 'calculated', 'invoices', 'Invoices', FALSE, 9),

-- Tire services
('All Tires', 'alltires', 'direct', 'allTires', 'All Tires', FALSE, 10),
('Retail Tires', 'retailtires', 'direct', 'retailTires', 'Retail Tires', FALSE, 11),
('Tire Protection', 'tireprotection', 'direct', 'tireProtection', 'Tire Protection', FALSE, 12),
('Tire Protection %', 'tireprotection%', 'percentage', 'tireProtectionPercent', 'Tire Protection %', TRUE, 13),

-- Alignment services
('Potential Alignments', 'potentialalignments', 'direct', 'potentialAlignments', 'Potential Alignments', FALSE, 14),
('Potential Alignments Sold', 'potentialalignmentssold', 'direct', 'potentialAlignmentsSold', 'Potential Alignments Sold', FALSE, 15),
('Potential Alignments %', 'potentialalignments%', 'percentage', 'potentialAlignmentsPercent', 'Potential Alignments %', TRUE, 16),
('Alignments', 'alignments', 'direct', 'alignments', 'Alignments', FALSE, 17),

-- Brake services
('Brake Service', 'brakeservice', 'direct', 'brakeService', 'Brake Service', FALSE, 18),
('Brake Flush', 'brakeflush', 'direct', 'brakeFlush', 'Brake Flush', FALSE, 19),
('Brake Flush to Service %', 'brakeflushtoservice%', 'percentage', 'brakeFlushToServicePercent', 'Brake Flush to Service %', TRUE, 20),

-- Oil change services
('Oil Change', 'oilchange', 'direct', 'oilChange', 'Oil Change', FALSE, 21),
('Premium Oil Change', 'premiumoilchange', 'direct', 'premiumOilChange', 'Premium Oil Change', FALSE, 22),

-- Filter services
('Engine Air Filter', 'engineairfilter', 'direct', 'engineAirFilter', 'Engine Air Filter', FALSE, 23),
('Cabin Air Filter', 'cabinairfilter', 'direct', 'cabinAirFilter', 'Cabin Air Filter', FALSE, 24),

-- Fluid services
('Coolant Flush', 'coolantflush', 'direct', 'coolantFlush', 'Coolant Flush', FALSE, 25),
('Differential Service', 'differentialservice', 'direct', 'differentialService', 'Differential Service', FALSE, 26),
('Fuel System Service', 'fuelsystemservice', 'direct', 'fuelSystemService', 'Fuel System Service', FALSE, 27),
('Power Steering Flush', 'powersteeringflush', 'direct', 'powerSteeringFlush', 'Power Steering Flush', FALSE, 28),
('Transmission Fluid Service', 'transmissionfluidservice', 'direct', 'transmissionFluidService', 'Transmission Fluid Service', FALSE, 29),

-- Other services
('Shocks & Struts', 'shocksstruts', 'direct', 'shocksStruts', 'Shocks & Struts', FALSE, 30),
('Wiper Blades', 'wiperblades', 'direct', 'wiperBlades', 'Wiper Blades', FALSE, 31),
('AC Service', 'acservice', 'direct', 'acService', 'AC Service', FALSE, 32),
('Battery', 'battery', 'direct', 'battery', 'Battery', FALSE, 33),
('Fuel Additive', 'fueladditive', 'direct', 'fuelAdditive', 'Fuel Additive', FALSE, 34),
('Engine Flush', 'engineflush', 'direct', 'engineFlush', 'Engine Flush', FALSE, 35),
('Filters', 'filters', 'direct', 'filters', 'Filters', FALSE, 36),

-- Common otherServices (nested) mappings
('Tire Balance', 'tirebalance', 'nested', 'Tire Balance', 'Tire Balance', FALSE, 37),
('Tire Rotation', 'tirerotation', 'nested', 'Tire Rotation', 'Tire Rotation', FALSE, 38),
('Battery Service', 'batteryservice', 'nested', 'Battery Service', 'Battery Service', FALSE, 39),
('Spark Plug Replacement', 'sparkplugreplacement', 'nested', 'Spark Plug Replacement', 'Spark Plug Replacement', FALSE, 40),
('Premium Alignments', 'premiumalignments', 'nested', 'Premium Alignments', 'Premium Alignments', FALSE, 41),
('Belts Replacement', 'beltsreplacement', 'nested', 'Belts Replacement', 'Belts Replacement', FALSE, 42),
('Engine Performance Service', 'engineperformanceservice', 'nested', 'Engine Performance Service', 'Engine Performance Service', FALSE, 43),
('Complete Vehicle Inspection', 'completevehicleinspection', 'nested', 'Complete Vehicle Inspection', 'Complete Vehicle Inspection', FALSE, 44),
('Hose Replacement', 'hosereplacement', 'nested', 'Hose Replacement', 'Hose Replacement', FALSE, 45),
('Climate Control Service', 'climatecontrolservice', 'nested', 'Climate Control Service', 'Climate Control Service', FALSE, 46),
('TPMS', 'tpms', 'nested', 'TPMS', 'TPMS', FALSE, 47),
('Nitrogen', 'nitrogen', 'nested', 'Nitrogen', 'Nitrogen', FALSE, 48),
('Timing Belt', 'timingbelt', 'nested', 'Timing Belt', 'Timing Belt', FALSE, 49),
('Transfer Case Service', 'transfercaseservice', 'nested', 'Transfer Case Service', 'Transfer Case Service', FALSE, 50),
('Headlight Restoration Service', 'headlightrestorationservice', 'nested', 'Headlight Restoration Service', 'Headlight Restoration Service', FALSE, 51),
('Synthetic Oil Change', 'syntheticoilchange', 'nested', 'Synthetic Oil Change', 'Synthetic Oil Change', FALSE, 52),
('Synthetic Blend Oil Change', 'syntheticblendoilchange', 'nested', 'Synthetic Blend Oil Change', 'Synthetic Blend Oil Change', FALSE, 53),
('Fuel Filter', 'fuelfilter', 'nested', 'Fuel Filter', 'Fuel Filter', FALSE, 54);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_default_field_mappings_header ON default_field_mappings(spreadsheet_header);
CREATE INDEX IF NOT EXISTS idx_default_field_mappings_key ON default_field_mappings(scorecard_field_key);
CREATE INDEX IF NOT EXISTS idx_service_field_mappings_market ON service_field_mappings(market_id);
CREATE INDEX IF NOT EXISTS idx_service_field_mappings_header ON service_field_mappings(spreadsheet_header);
CREATE INDEX IF NOT EXISTS idx_discovered_headers_market ON discovered_spreadsheet_headers(market_id);

-- Function to get effective field mappings (market-specific overrides + defaults)
CREATE OR REPLACE FUNCTION get_effective_field_mappings(p_market_id INTEGER DEFAULT NULL)
RETURNS TABLE(
  spreadsheet_header VARCHAR(255),
  scorecard_field_key VARCHAR(255),
  field_type VARCHAR(20),
  data_field_name VARCHAR(255),
  display_label VARCHAR(255),
  is_percentage BOOLEAN,
  sort_order INTEGER,
  is_override BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH market_overrides AS (
    SELECT 
      sfm.spreadsheet_header,
      sfm.scorecard_field_key,
      sfm.field_type,
      sfm.data_field_name,
      sfm.display_label,
      sfm.is_percentage,
      sfm.sort_order,
      TRUE as is_override
    FROM service_field_mappings sfm
    WHERE sfm.market_id = p_market_id
      AND sfm.is_active = TRUE
  ),
  defaults_not_overridden AS (
    SELECT 
      dfm.spreadsheet_header,
      dfm.scorecard_field_key,
      dfm.field_type,
      dfm.data_field_name,
      dfm.display_label,
      dfm.is_percentage,
      dfm.sort_order,
      FALSE as is_override
    FROM default_field_mappings dfm
    WHERE dfm.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM market_overrides mo 
        WHERE mo.spreadsheet_header = dfm.spreadsheet_header 
          AND mo.scorecard_field_key = dfm.scorecard_field_key
      )
  )
  SELECT * FROM market_overrides
  UNION ALL
  SELECT * FROM defaults_not_overridden
  ORDER BY sort_order, spreadsheet_header;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE default_field_mappings IS 'Global default mappings from spreadsheet headers to scorecard fields';
COMMENT ON TABLE service_field_mappings IS 'Market-specific overrides for field mappings';
COMMENT ON TABLE discovered_spreadsheet_headers IS 'Log of spreadsheet headers discovered during file uploads';
COMMENT ON FUNCTION get_effective_field_mappings IS 'Returns effective field mappings for a market (overrides + defaults)';