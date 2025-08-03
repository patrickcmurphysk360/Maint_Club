-- Add Industry Benchmarks as AI Coaching Tips
-- These benchmarks are based on automotive aftermarket industry standards

-- First, ensure the ai_coaching_tips table exists
CREATE TABLE IF NOT EXISTS ai_coaching_tips (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  trigger_conditions JSONB,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add Industry Benchmarks category
INSERT INTO ai_coaching_tips (category, title, content, trigger_conditions, is_active) VALUES
-- Tire Performance Benchmarks
('Industry Benchmarks', 'Tire Attach Rate Standards', 
'Industry benchmarks for tire attach rates:
• Below Average: < 15% tire attach rate
• Average: 15-25% tire attach rate  
• Good: 25-35% tire attach rate
• Excellent: > 35% tire attach rate

Top performers achieve 40%+ by:
- Conducting visual tire inspections on every vehicle
- Using tread depth gauges consistently
- Showing customers actual tire wear
- Offering financing options', 
'{"metric": "tire_attach_rate", "ranges": {"below_average": [0, 0.15], "average": [0.15, 0.25], "good": [0.25, 0.35], "excellent": [0.35, 1.0]}}',
true),

-- Oil Change Upsell Benchmarks
('Industry Benchmarks', 'Oil Change Service Upsell Rates',
'Industry standards for oil change upsells:
• Below Average: < 30% additional service rate
• Average: 30-40% additional service rate
• Good: 40-55% additional service rate  
• Excellent: > 55% additional service rate

Best practices include:
- Multi-point inspections with every oil change
- Digital inspection reports with photos
- Educating customers on maintenance schedules
- Bundle pricing for multiple services',
'{"metric": "oil_change_upsell", "ranges": {"below_average": [0, 0.30], "average": [0.30, 0.40], "good": [0.40, 0.55], "excellent": [0.55, 1.0]}}',
true),

-- Average Ticket Size Benchmarks
('Industry Benchmarks', 'Average Repair Order (ARO) Standards',
'Industry benchmarks for Average Repair Order:
• Below Average: < $350 ARO
• Average: $350-$450 ARO
• Good: $450-$650 ARO
• Excellent: > $650 ARO

Top shops achieve higher ARO through:
- Comprehensive vehicle inspections
- Maintenance package offerings
- Premium service options
- Effective service advisor training',
'{"metric": "average_ticket", "ranges": {"below_average": [0, 350], "average": [350, 450], "good": [450, 650], "excellent": [650, 10000]}}',
true),

-- Gross Profit Benchmarks
('Industry Benchmarks', 'Gross Profit Percentage Standards',
'Automotive service gross profit benchmarks:
• Below Average: < 50% GP
• Average: 50-55% GP
• Good: 55-60% GP
• Excellent: > 60% GP

Key factors for healthy GP:
- Proper parts matrix pricing
- Labor rate optimization
- Effective mix of services
- Reduced comebacks and warranty work',
'{"metric": "gross_profit_percent", "ranges": {"below_average": [0, 50], "average": [50, 55], "good": [55, 60], "excellent": [60, 100]}}',
true),

-- Customer Retention Benchmarks
('Industry Benchmarks', 'Customer Retention Rate Standards',
'Industry customer retention benchmarks:
• Below Average: < 50% return rate
• Average: 50-70% return rate
• Good: 70-85% return rate
• Excellent: > 85% return rate

Retention strategies:
- Follow-up communication programs
- Maintenance reminder systems
- Loyalty rewards programs
- Exceptional customer service training',
'{"metric": "customer_retention", "ranges": {"below_average": [0, 0.50], "average": [0.50, 0.70], "good": [0.70, 0.85], "excellent": [0.85, 1.0]}}',
true),

-- Alignment Service Benchmarks
('Industry Benchmarks', 'Alignment Service Attach Rate',
'Alignment service attachment benchmarks:
• Below Average: < 10% attach rate
• Average: 10-15% attach rate
• Good: 15-25% attach rate
• Excellent: > 25% attach rate

Best practices:
- Check alignment on tire sales
- Visual inspection of tire wear patterns
- Test drive feedback documentation
- Alignment check promotions',
'{"metric": "alignment_attach", "ranges": {"below_average": [0, 0.10], "average": [0.10, 0.15], "good": [0.15, 0.25], "excellent": [0.25, 1.0]}}',
true),

-- Brake Service Benchmarks
('Industry Benchmarks', 'Brake Service Performance',
'Brake service sales benchmarks:
• Below Average: < 8% of services
• Average: 8-12% of services
• Good: 12-18% of services
• Excellent: > 18% of services

Key success factors:
- Brake inspection with every service
- Measuring brake pad thickness
- Customer education on safety
- Competitive brake service packages',
'{"metric": "brake_service_rate", "ranges": {"below_average": [0, 0.08], "average": [0.08, 0.12], "good": [0.12, 0.18], "excellent": [0.18, 1.0]}}',
true),

-- Hours Per RO Benchmarks
('Industry Benchmarks', 'Labor Hours Per Repair Order',
'Industry standards for labor hours per RO:
• Below Average: < 1.5 hours
• Average: 1.5-2.0 hours
• Good: 2.0-2.5 hours
• Excellent: > 2.5 hours

Improvement strategies:
- Thorough vehicle inspections
- Identifying all needed repairs
- Bundling related services
- Preventive maintenance focus',
'{"metric": "hours_per_ro", "ranges": {"below_average": [0, 1.5], "average": [1.5, 2.0], "good": [2.0, 2.5], "excellent": [2.5, 10]}}',
true),

-- First-Time Fix Rate
('Industry Benchmarks', 'First-Time Fix Rate Standards',
'First-time fix rate benchmarks:
• Below Average: < 85% 
• Average: 85-90%
• Good: 90-95%
• Excellent: > 95%

Critical success factors:
- Accurate diagnosis procedures
- Quality parts sourcing
- Technician training programs
- Proper quality control checks',
'{"metric": "first_time_fix", "ranges": {"below_average": [0, 0.85], "average": [0.85, 0.90], "good": [0.90, 0.95], "excellent": [0.95, 1.0]}}',
true),

-- Service Advisor Productivity
('Industry Benchmarks', 'Service Advisor Sales Performance',
'Monthly sales per advisor benchmarks:
• Below Average: < $80,000
• Average: $80,000-$120,000
• Good: $120,000-$160,000
• Excellent: > $160,000

Top performer characteristics:
- Strong product knowledge
- Consultative selling approach
- Consistent follow-up
- Technology utilization',
'{"metric": "advisor_monthly_sales", "ranges": {"below_average": [0, 80000], "average": [80000, 120000], "good": [120000, 160000], "excellent": [160000, 1000000]}}',
true);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_coaching_tips_category ON ai_coaching_tips(category);
CREATE INDEX IF NOT EXISTS idx_coaching_tips_active ON ai_coaching_tips(is_active);

COMMENT ON TABLE ai_coaching_tips IS 'Stores AI coaching tips including industry benchmarks for automotive service metrics';