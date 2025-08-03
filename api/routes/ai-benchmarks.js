const express = require('express');
const router = express.Router();

// Initialize industry benchmarks
router.post('/initialize', async (req, res) => {
  try {
    // Only admins can initialize benchmarks
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const pool = req.app.locals.pool;
    
    // First ensure the table exists
    await pool.query(`
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
      )
    `);

    // Check if benchmarks already exist
    const existingResult = await pool.query(
      "SELECT COUNT(*) as count FROM ai_coaching_tips WHERE category = 'Industry Benchmarks'"
    );

    if (existingResult.rows[0].count > 0) {
      return res.json({ 
        message: 'Industry benchmarks already initialized',
        count: existingResult.rows[0].count
      });
    }

    // Industry benchmark data
    const benchmarks = [
      {
        title: 'Tire Attach Rate Standards',
        content: `Industry benchmarks for tire attach rates:
• Below Average: < 15% tire attach rate
• Average: 15-25% tire attach rate  
• Good: 25-35% tire attach rate
• Excellent: > 35% tire attach rate

Top performers achieve 40%+ by:
- Conducting visual tire inspections on every vehicle
- Using tread depth gauges consistently
- Showing customers actual tire wear
- Offering financing options`,
        trigger_conditions: {
          metric: "tire_attach_rate",
          ranges: {
            below_average: [0, 0.15],
            average: [0.15, 0.25],
            good: [0.25, 0.35],
            excellent: [0.35, 1.0]
          }
        }
      },
      {
        title: 'Oil Change Service Upsell Rates',
        content: `Industry standards for oil change upsells:
• Below Average: < 30% additional service rate
• Average: 30-40% additional service rate
• Good: 40-55% additional service rate  
• Excellent: > 55% additional service rate

Best practices include:
- Multi-point inspections with every oil change
- Digital inspection reports with photos
- Educating customers on maintenance schedules
- Bundle pricing for multiple services`,
        trigger_conditions: {
          metric: "oil_change_upsell",
          ranges: {
            below_average: [0, 0.30],
            average: [0.30, 0.40],
            good: [0.40, 0.55],
            excellent: [0.55, 1.0]
          }
        }
      },
      {
        title: 'Average Repair Order (ARO) Standards',
        content: `Industry benchmarks for Average Repair Order:
• Below Average: < $350 ARO
• Average: $350-$450 ARO
• Good: $450-$650 ARO
• Excellent: > $650 ARO

Top shops achieve higher ARO through:
- Comprehensive vehicle inspections
- Maintenance package offerings
- Premium service options
- Effective service advisor training`,
        trigger_conditions: {
          metric: "average_ticket",
          ranges: {
            below_average: [0, 350],
            average: [350, 450],
            good: [450, 650],
            excellent: [650, 10000]
          }
        }
      },
      {
        title: 'Gross Profit Percentage Standards',
        content: `Automotive service gross profit benchmarks:
• Below Average: < 50% GP
• Average: 50-55% GP
• Good: 55-60% GP
• Excellent: > 60% GP

Key factors for healthy GP:
- Proper parts matrix pricing
- Labor rate optimization
- Effective mix of services
- Reduced comebacks and warranty work`,
        trigger_conditions: {
          metric: "gross_profit_percent",
          ranges: {
            below_average: [0, 50],
            average: [50, 55],
            good: [55, 60],
            excellent: [60, 100]
          }
        }
      },
      {
        title: 'Customer Retention Rate Standards',
        content: `Industry customer retention benchmarks:
• Below Average: < 50% return rate
• Average: 50-70% return rate
• Good: 70-85% return rate
• Excellent: > 85% return rate

Retention strategies:
- Follow-up communication programs
- Maintenance reminder systems
- Loyalty rewards programs
- Exceptional customer service training`,
        trigger_conditions: {
          metric: "customer_retention",
          ranges: {
            below_average: [0, 0.50],
            average: [0.50, 0.70],
            good: [0.70, 0.85],
            excellent: [0.85, 1.0]
          }
        }
      },
      {
        title: 'Alignment Service Attach Rate',
        content: `Alignment service attachment benchmarks:
• Below Average: < 10% attach rate
• Average: 10-15% attach rate
• Good: 15-25% attach rate
• Excellent: > 25% attach rate

Best practices:
- Check alignment on tire sales
- Visual inspection of tire wear patterns
- Test drive feedback documentation
- Alignment check promotions`,
        trigger_conditions: {
          metric: "alignment_attach",
          ranges: {
            below_average: [0, 0.10],
            average: [0.10, 0.15],
            good: [0.15, 0.25],
            excellent: [0.25, 1.0]
          }
        }
      },
      {
        title: 'Brake Service Performance',
        content: `Brake service sales benchmarks:
• Below Average: < 8% of services
• Average: 8-12% of services
• Good: 12-18% of services
• Excellent: > 18% of services

Key success factors:
- Brake inspection with every service
- Measuring brake pad thickness
- Customer education on safety
- Competitive brake service packages`,
        trigger_conditions: {
          metric: "brake_service_rate",
          ranges: {
            below_average: [0, 0.08],
            average: [0.08, 0.12],
            good: [0.12, 0.18],
            excellent: [0.18, 1.0]
          }
        }
      },
      {
        title: 'Labor Hours Per Repair Order',
        content: `Industry standards for labor hours per RO:
• Below Average: < 1.5 hours
• Average: 1.5-2.0 hours
• Good: 2.0-2.5 hours
• Excellent: > 2.5 hours

Improvement strategies:
- Thorough vehicle inspections
- Identifying all needed repairs
- Bundling related services
- Preventive maintenance focus`,
        trigger_conditions: {
          metric: "hours_per_ro",
          ranges: {
            below_average: [0, 1.5],
            average: [1.5, 2.0],
            good: [2.0, 2.5],
            excellent: [2.5, 10]
          }
        }
      },
      {
        title: 'Service Advisor Sales Performance',
        content: `Monthly sales per advisor benchmarks:
• Below Average: < $80,000
• Average: $80,000-$120,000
• Good: $120,000-$160,000
• Excellent: > $160,000

Top performer characteristics:
- Strong product knowledge
- Consultative selling approach
- Consistent follow-up
- Technology utilization`,
        trigger_conditions: {
          metric: "advisor_monthly_sales",
          ranges: {
            below_average: [0, 80000],
            average: [80000, 120000],
            good: [120000, 160000],
            excellent: [160000, 1000000]
          }
        }
      }
    ];

    // Insert all benchmarks
    let insertedCount = 0;
    for (const benchmark of benchmarks) {
      await pool.query(`
        INSERT INTO ai_coaching_tips 
        (category, title, content, trigger_conditions, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'Industry Benchmarks',
        benchmark.title,
        benchmark.content,
        JSON.stringify(benchmark.trigger_conditions),
        true,
        req.user.id
      ]);
      insertedCount++;
    }

    console.log(`✅ Initialized ${insertedCount} industry benchmarks by user ${req.user.email}`);

    res.json({
      message: 'Industry benchmarks initialized successfully',
      count: insertedCount,
      created_by: req.user.email
    });

  } catch (error) {
    console.error('❌ Error initializing benchmarks:', error);
    res.status(500).json({
      message: 'Error initializing industry benchmarks',
      error: error.message
    });
  }
});

// Get industry benchmarks
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(`
      SELECT 
        id,
        title,
        content,
        trigger_conditions,
        is_active,
        created_at,
        updated_at
      FROM ai_coaching_tips
      WHERE category = 'Industry Benchmarks'
      AND is_active = true
      ORDER BY title
    `);

    res.json({
      benchmarks: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error fetching benchmarks:', error);
    res.status(500).json({
      message: 'Error fetching industry benchmarks',
      error: error.message
    });
  }
});

module.exports = router;