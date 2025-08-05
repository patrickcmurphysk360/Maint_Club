const { Pool } = require('pg');
const AIDataService = require('./services/aiDataService');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testCodyAIScorecard() {
  try {
    console.log('🤖 Testing AI scorecard response for Cody Lanier...\n');
    
    const aiService = new AIDataService(pool);
    
    // Test the exact query that should trigger scorecard response
    const testQuery = "Get Cody Lanier's scorecard for August";
    const adminUserId = 1; // Admin user
    
    console.log(`📝 Query: "${testQuery}"`);
    console.log(`👤 Admin User ID: ${adminUserId}\n`);
    
    // Step 1: Test performance intent detection
    const isPerformanceQuery = aiService.detectPerformanceIntent(testQuery);
    console.log(`🎯 Performance intent detected: ${isPerformanceQuery}`);
    
    // Step 2: Build comprehensive context (this is what the AI uses)
    console.log('\n🔄 Building comprehensive context...');
    const context = await aiService.buildComprehensiveContext(adminUserId, testQuery);
    
    console.log('\n📊 Context Performance Data:');
    console.log('- Is performance query:', context.performance?.is_performance_query);
    console.log('- Is specific person query:', context.performance?.is_specific_person_query);
    console.log('- Specific person name:', context.performance?.specific_person_name);
    console.log('- Data source:', context.performance?.data_source);
    console.log('- Policy compliant:', context.performance?.policy_compliant);
    
    if (context.performance?.validated_data) {
      console.log('\n✅ Validated performance data found:');
      console.log('- Success:', context.performance.validated_data.success);
      
      if (context.performance.validated_data.success && context.performance.validated_data.data) {
        const data = context.performance.validated_data.data;
        console.log('- User ID:', data.userId);
        console.log('- Period:', JSON.stringify(data.period));
        console.log('- Core metrics:', JSON.stringify(data.metrics));
        console.log('- Service count:', Object.keys(data.services || {}).length);
        console.log('- Full services data available:', !!data.services);
        
        // Show a sample of services to verify completeness
        if (data.services) {
          console.log('\n🔧 Sample services data:');
          const serviceKeys = Object.keys(data.services);
          serviceKeys.slice(0, 10).forEach(key => {
            console.log(`  - ${key}: ${data.services[key]}`);
          });
          if (serviceKeys.length > 10) {
            console.log(`  ... and ${serviceKeys.length - 10} more services`);
          }
        }
      } else {
        console.log('❌ No performance data in validated response');
        console.log('Error:', context.performance.validated_data.error);
      }
    } else {
      console.log('❌ No validated_data in context.performance');
    }
    
    // Step 3: Test organizational query detection (should not override performance data)
    console.log('\n🏢 Testing organizational query detection...');
    const orgData = await aiService.analyzeOrganizationalQuery(testQuery, adminUserId);
    console.log('- Organizational data found:', !!orgData);
    console.log('- Should not override performance query:', !orgData || context.performance?.is_performance_query);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testCodyAIScorecard();