-- Service Catalog with Categories
-- Organized by service type for better vendor mapping
-- Handles duplicates with ON CONFLICT

INSERT INTO service_catalog (service_name, service_category, display_order, description) VALUES
-- Core Metrics
('Invoices', 'Core Metrics', 1, 'Total number of invoices/transactions'),
('Sales', 'Core Metrics', 2, 'Total sales revenue'),
('Avg. Spend', 'Core Metrics', 3, 'Average spend per customer'),
('GP Sales', 'Core Metrics', 4, 'Gross profit sales amount'),
('GP Percent', 'Core Metrics', 5, 'Gross profit percentage'),

-- Tire Services
('All Tires', 'Tire Services', 10, 'All tire sales including retail and other'),
('Retail Tires', 'Tire Services', 11, 'Retail tire sales'),
('Tire Protection', 'Tire Services', 12, 'Tire protection plan sales'),
('Tire Protection %', 'Tire Services', 13, 'Tire protection attachment percentage'),
('Tire Balance', 'Tire Services', 14, 'Tire balancing service'),
('Tire Rotation', 'Tire Services', 15, 'Tire rotation service'),
('TPMS', 'Tire Services', 16, 'Tire pressure monitoring system service'),
('Nitrogen', 'Tire Services', 17, 'Nitrogen tire filling service'),

-- Alignment Services  
('Potential Alignments', 'Alignment Services', 20, 'Potential alignment opportunities identified'),
('Potential Alignments Sold', 'Alignment Services', 21, 'Potential alignments converted to sales'),
('Potential Alignments %', 'Alignment Services', 22, 'Potential alignment conversion rate'),
('Alignments', 'Alignment Services', 23, 'Standard alignment service'),
('Premium Alignments', 'Alignment Services', 24, 'Premium/lifetime alignment service'),

-- Oil Change Services
('Oil Change', 'Oil Change Services', 30, 'Standard oil change service'),
('Premium Oil Change', 'Oil Change Services', 31, 'Premium oil change service'),
('Synthetic Oil Change', 'Oil Change Services', 32, 'Full synthetic oil change'),
('Synthetic Blend Oil Change', 'Oil Change Services', 33, 'Synthetic blend oil change'),

-- Filter Services
('Engine Air Filter', 'Filter Services', 40, 'Engine air filter replacement'),
('Cabin Air Filter', 'Filter Services', 41, 'Cabin air filter replacement'),
('Fuel Filter', 'Filter Services', 42, 'Fuel filter replacement'),

-- Brake Services
('Brake Service', 'Brake Services', 50, 'General brake service'),
('Brake Flush', 'Brake Services', 51, 'Brake fluid flush service'),
('Brake Flush to Service %', 'Brake Services', 52, 'Brake flush to service conversion rate'),

-- Fluid Services
('Coolant Flush', 'Fluid Services', 60, 'Coolant system flush'),
('Power Steering Flush', 'Fluid Services', 61, 'Power steering fluid service'),
('Transmission Fluid Service', 'Fluid Services', 62, 'Transmission fluid change'),
('Differential Service', 'Fluid Services', 63, 'Differential fluid service'),
('Transfer Case Service', 'Fluid Services', 64, 'Transfer case fluid service'),

-- Fuel & Engine Services
('Fuel System Service', 'Fuel & Engine Services', 70, 'Fuel system cleaning service'),
('Fuel Additive', 'Fuel & Engine Services', 71, 'Fuel additive application'),
('Engine Performance Service', 'Fuel & Engine Services', 72, 'Engine performance optimization'),
('Engine Flush', 'Fuel & Engine Services', 73, 'Engine oil flush service'),
('Spark Plug Replacement', 'Fuel & Engine Services', 74, 'Spark plug replacement'),
('Timing Belt', 'Fuel & Engine Services', 75, 'Timing belt replacement'),

-- Suspension & Steering
('Shocks & Struts', 'Suspension & Steering', 80, 'Shock absorber and strut service'),

-- Electrical & Battery
('Battery', 'Electrical & Battery', 90, 'Battery replacement'),
('Battery Service', 'Electrical & Battery', 91, 'Battery testing and service'),

-- HVAC Services
('AC Service', 'HVAC Services', 100, 'Air conditioning service'),
('Climate Control Service', 'HVAC Services', 101, 'Climate control system service'),

-- Maintenance & Inspection
('Wiper Blades', 'Maintenance & Inspection', 110, 'Windshield wiper blade replacement'),
('Complete Vehicle Inspection', 'Maintenance & Inspection', 111, 'Comprehensive vehicle inspection'),
('Belts Replacement', 'Maintenance & Inspection', 112, 'Drive belt replacement'),
('Hose Replacement', 'Maintenance & Inspection', 113, 'Radiator/heater hose replacement'),
('Headlight Restoration Service', 'Maintenance & Inspection', 114, 'Headlight lens restoration')
ON CONFLICT (service_name) DO UPDATE
SET service_category = EXCLUDED.service_category,
    display_order = EXCLUDED.display_order,
    description = EXCLUDED.description;