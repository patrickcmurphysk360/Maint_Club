/**
 * Test AI Validation Middleware
 * 
 * Tests the new AI validation middleware that compares AI responses
 * against expected values from scorecard API endpoints.
 */

const { Pool } = require('pg');
const AIValidationMiddleware = require('./middleware/aiValidationMiddleware');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

async function testValidationMiddleware() {
  console.log('🧪 Testing AI Validation Middleware');
  console.log('=====================================\n');

  const middleware = new AIValidationMiddleware(pool);

  // Test cases with different scenarios
  const testCases = [
    {
      name: 'Accurate Response',
      query: 'What are Akeen Jackson\'s sales numbers?',
      aiResponse: 'Akeen Jackson had $15,234.56 in sales with 45 invoices and 12 alignments.',
      userId: 1, // Assuming user ID 1 exists
      expectedOutcome: 'Should pass validation if numbers match scorecard API'
    },
    {
      name: 'Inaccurate Sales Figure',
      query: 'How much did the advisor sell this month?',
      aiResponse: 'The advisor had $99,999.99 in total sales and completed 200 oil changes.',
      userId: 1,
      expectedOutcome: 'Should detect mismatch in sales figure'
    },
    {
      name: 'Multiple Metric Mismatches',
      query: 'Show me performance breakdown',
      aiResponse: 'Sales: $50,000, GP: $25,000, Invoices: 300, Alignments: 150, Tires: 75',
      userId: 1,
      expectedOutcome: 'Should detect multiple mismatches and generate disclaimer'
    },
    {
      name: 'Non-Performance Query',
      query: 'What stores are in the Atlanta market?',
      aiResponse: 'The Atlanta market has 5 stores: Store A, Store B, Store C, Store D, and Store E.',
      userId: 1,
      expectedOutcome: 'Should skip performance validation'
    },
    {
      name: 'Edge Case - No Scorecard Data',
      query: 'What are my sales numbers?',
      aiResponse: 'Your sales are $10,000 with 25 invoices.',
      userId: 9999, // Non-existent user
      expectedOutcome: 'Should handle missing scorecard data gracefully'
    }
  ];

  for (const testCase of testCases) {
    console.log(`🔍 Test: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectedOutcome}`);
    
    try {
      const startTime = Date.now();
      
      const validationResult = await middleware.validateAIResponse(
        testCase.query,
        testCase.aiResponse,
        testCase.userId,
        { performance: { is_performance_query: true } }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Validation completed in ${duration}ms`);
      console.log(`✅ Valid: ${validationResult.isValid}`);
      console.log(`📊 Confidence: ${validationResult.confidenceScore}`);
      console.log(`🚨 Mismatches: ${validationResult.mismatches.length}`);
      
      if (validationResult.disclaimer) {
        console.log(`⚠️  Disclaimer: ${validationResult.disclaimer}`);
      }
      
      if (validationResult.mismatches.length > 0) {
        console.log('📝 Detected Mismatches:');
        validationResult.mismatches.forEach((mismatch, index) => {
          console.log(`   ${index + 1}. ${mismatch.metric}: Expected ${mismatch.expected}, Got ${mismatch.detected} (${mismatch.severity})`);
        });
      }
      
      console.log(`🔢 Expected Values: ${JSON.stringify(validationResult.expectedValues, null, 2)}`);
      console.log(`🔍 Detected Values: ${JSON.stringify(validationResult.detectedValues, null, 2)}`);
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
    
    console.log('\n' + '─'.repeat(50) + '\n');
  }

  // Test statistics and dashboard functions
  console.log('📊 Testing Dashboard Functions');
  console.log('===============================\n');

  try {
    const stats = await middleware.getValidationStats(7);
    console.log('📈 Validation Stats (Last 7 days):');
    console.log(`   Total Validations: ${stats.total_validations || 0}`);
    console.log(`   Passed: ${stats.passed_validations || 0}`);
    console.log(`   Failed: ${stats.failed_validations || 0}`);
    console.log(`   Average Confidence: ${stats.avg_confidence_score || 1.0}`);
    console.log(`   Average Mismatches: ${stats.avg_mismatch_count || 0}`);
    console.log(`   Unique Users: ${stats.unique_users || 0}`);
  } catch (error) {
    console.error(`❌ Stats test failed: ${error.message}`);
  }

  console.log('\n✅ All tests completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Run the database migration: database-scripts/08-ai-validation-audit-tables.sql');
  console.log('2. Test the API endpoints: /api/ai-validation/stats, /api/ai-validation/dashboard');
  console.log('3. Verify AI responses are being validated in real-time');
  console.log('4. Check audit logs for validation results');
}

// Run the tests
testValidationMiddleware()
  .then(() => {
    console.log('\n🎉 Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  pool.end();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  pool.end();
  process.exit(1);
});