const pool = require('./db');

async function debugContext() {
  console.log('🔍 Debugging AI Context Building...\n');
  
  try {
    const AIDataService = require('./services/aiDataService');
    const aiDataService = new AIDataService(pool);
    
    // Test building context for Cody query
    const query = 'show me the scorecard for cody lanier for august 2025';
    const userId = 1; // Admin user
    
    console.log('📊 Building comprehensive context...');
    const context = await aiDataService.buildComprehensiveContext(userId, query);
    
    console.log('\n🔍 Context Performance Data:');
    console.log('   is_performance_query:', context.performance?.is_performance_query);
    console.log('   is_specific_person_query:', context.performance?.is_specific_person_query);
    console.log('   specific_person_name:', context.performance?.specific_person_name);
    console.log('   validated_data.success:', context.performance?.validated_data?.success);
    console.log('   validated_data.data exists:', !!context.performance?.validated_data?.data);
    
    if (context.performance?.validated_data?.data) {
      const data = context.performance.validated_data.data;
      console.log('\n📊 Actual Scorecard Data:');
      console.log('   sales:', data.sales);
      console.log('   invoices:', data.invoices);
      console.log('   retailTires:', data.retailTires);
      console.log('   gpSales:', data.gpSales);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugContext().catch(console.error);