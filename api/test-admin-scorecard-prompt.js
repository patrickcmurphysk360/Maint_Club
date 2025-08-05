/**
 * Test Admin Scorecard Prompt Implementation
 * Tests the complete flow from admin query to formatted response
 */

const OllamaService = require('./services/ollamaService');
const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

const ollamaService = new OllamaService();
const aiDataService = new AIDataService(pool);

async function testAdminScorecardPrompt() {
  console.log('🧪 Testing Admin Scorecard Prompt Implementation');
  console.log('=' .repeat(60));
  
  // Test admin user context
  const adminUser = {
    id: 1,
    role: 'admin',
    name: 'Admin User',
    market: 'Test Market',
    store: 'Test Store'
  };
  
  // Test query exactly as provided
  const testQuery = "As an admin, give me the complete August scorecard for Cody Lanier. Include all performance metrics such as retail tires, oil changes, alignments, invoices, and total production. If any data is missing, say so explicitly — do not guess or fabricate. Do not include disclaimers. Pull real values only from the provided `scorecardData` object.";
  
  console.log('🎯 Test Query:', testQuery);
  console.log('👤 Admin User:', adminUser.name, `(${adminUser.role})`);
  console.log('');
  
  try {
    // Build AI context for Cody Lanier
    console.log('🔍 Building AI context for Cody Lanier...');
    const context = await aiDataService.buildComprehensiveContext(adminUser.id, testQuery);
    context.user = adminUser; // Override with admin user
    
    console.log('📊 Context Performance Data:');
    console.log('- Is Performance Query:', context.performance?.is_performance_query);
    console.log('- Is Specific Person Query:', context.performance?.is_specific_person_query);
    console.log('- Specific Person Name:', context.performance?.specific_person_name);
    console.log('- Validated Data Available:', !!context.performance?.validated_data?.success);
    
    if (context.performance?.validated_data?.data) {
      const data = context.performance.validated_data.data;
      console.log('- Data Keys:', Object.keys(data));
      console.log('- Metrics Keys:', data.metrics ? Object.keys(data.metrics) : 'None');
      console.log('- Services Keys:', data.services ? Object.keys(data.services).slice(0, 5) : 'None');
    }
    console.log('');
    
    // Test admin detection
    const isAdmin = context.user?.role === 'admin' || context.user?.role === 'administrator';
    const isPerformanceQuery = context.performance?.is_performance_query;
    
    console.log('🔓 Admin Detection:');
    console.log('- Is Admin User:', isAdmin);
    console.log('- Is Performance Query:', isPerformanceQuery);
    console.log('- Should Use Admin Prompt:', isAdmin && isPerformanceQuery && context.performance?.validated_data);
    console.log('');
    
    // Generate the prompt
    console.log('📝 Generating Admin Scorecard Prompt...');
    const prompt = ollamaService.generateEnhancedPrompt(testQuery, context);
    
    console.log('📋 Generated Prompt Preview (first 500 chars):');
    console.log(prompt.substring(0, 500) + '...');
    console.log('');
    
    // Check if the prompt uses admin template
    const usesAdminTemplate = prompt.includes('## 🧠 CORE RULES') && prompt.includes('DO NOT fabricate, estimate, or infer data');
    console.log('✅ Uses Admin Template:', usesAdminTemplate);
    
    // Check for prohibited content in admin prompts
    const hasProhibitedContent = prompt.includes('N/A') || prompt.includes('⚠️') || prompt.includes('POLICY VIOLATION');
    console.log('🚫 Contains Prohibited Content (N/A, warnings):', hasProhibitedContent);
    
    // Extract scorecard data from prompt
    const scorecardDataMatch = prompt.match(/\{[\s\S]*?"advisor"[\s\S]*?\}/);
    if (scorecardDataMatch) {
      console.log('');
      console.log('📊 Scorecard Data Structure:');
      try {
        const scorecardData = JSON.parse(scorecardDataMatch[0]);
        console.log('- Advisor:', scorecardData.advisor);
        console.log('- Month:', scorecardData.month);
        console.log('- Store:', scorecardData.store);
        console.log('- Metrics Keys:', Object.keys(scorecardData.metrics || {}));
        console.log('- Services Keys:', Object.keys(scorecardData.services || {}));
        console.log('- Goals Keys:', Object.keys(scorecardData.goals || {}));
        
        // Check for "Data not available" usage
        const metricsStr = JSON.stringify(scorecardData.metrics || {});
        const servicesStr = JSON.stringify(scorecardData.services || {});
        const dataNotAvailableCount = (metricsStr.match(/Data not available/g) || []).length + 
                                     (servicesStr.match(/Data not available/g) || []).length;
        console.log('- "Data not available" entries:', dataNotAvailableCount);
        
        console.log('');
        console.log('📋 Sample Metrics:');
        Object.entries(scorecardData.metrics || {}).slice(0, 4).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
        
        console.log('');
        console.log('📋 Sample Services:');
        Object.entries(scorecardData.services || {}).slice(0, 4).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
        
      } catch (e) {
        console.log('❌ Failed to parse scorecard data JSON');
      }
    } else {
      console.log('❌ No scorecard data found in prompt');
    }
    
    console.log('');
    console.log('🎯 Test Results Summary:');
    console.log('✅ Admin user detected:', isAdmin);
    console.log('✅ Performance query detected:', isPerformanceQuery);
    console.log('✅ Admin template used:', usesAdminTemplate);
    console.log('✅ No prohibited content:', !hasProhibitedContent);
    console.log('✅ Scorecard data structured:', !!scorecardDataMatch);
    
    const allTestsPassed = isAdmin && isPerformanceQuery && usesAdminTemplate && !hasProhibitedContent && !!scorecardDataMatch;
    console.log('');
    console.log(allTestsPassed ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testAdminScorecardPrompt().catch(console.error);