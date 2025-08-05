const { Pool } = require('pg');
const AIDataService = require('./services/aiDataService');
const { getValidatedScorecardData } = require('./utils/scorecardDataAccess');

// Database connection
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432,
});

async function testCompleteAdminScorecard() {
  try {
    console.log('🔓 Testing COMPLETE admin scorecard access...\n');
    
    // Step 1: Test direct API call first
    console.log('📡 Step 1: Testing direct API call...');
    const directResult = await getValidatedScorecardData({
      level: 'advisor',
      id: 244,
      baseURL: 'http://localhost:5000',
      mtdMonth: 8,
      mtdYear: 2025
    });
    
    console.log('Direct API result:', {
      success: directResult.success,
      dataPresent: !!directResult.data,
      serviceCount: directResult.data?.services ? Object.keys(directResult.data.services).length : 0,
      error: directResult.success ? null : 'Failed'
    });
    
    if (directResult.success && directResult.data) {
      console.log('\n✅ Direct API call successful! Sample data:');
      console.log('- User ID:', directResult.data.userId);
      console.log('- Invoices:', directResult.data.metrics?.invoices);
      console.log('- Sales:', directResult.data.metrics?.sales);
      console.log('- Retail Tires:', directResult.data.services?.['Retail Tires']);
      console.log('- Alignments:', directResult.data.services?.['Alignments']);
      console.log('- Oil Change:', directResult.data.services?.['Oil Change']);
      
      // Step 2: Test AI context building
      console.log('\n🤖 Step 2: Testing AI context building...');
      const aiService = new AIDataService(pool);
      
      // Mock admin user data for testing
      const adminUserData = {
        id: 1,
        firstName: 'Admin',
        lastName: 'User', 
        role: 'admin',
        name: 'Admin User'
      };
      
      // Manually build performance context like the AI would
      const mockContext = {
        user: adminUserData,
        performance: {
          is_performance_query: true,
          is_specific_person_query: true,
          specific_person_name: 'cody lanier',
          data_source: 'validated_scorecard_api_enforced',
          policy_compliant: true,
          validated_data: directResult,
          
          // Admin-specific metadata
          adminAccess: true,
          completeDataset: true,
          queryParameters: { mtdMonth: 8, mtdYear: 2025 }
        }
      };
      
      console.log('\n📊 Mock AI Context for Admin:');
      console.log('- Admin access:', mockContext.performance.adminAccess);
      console.log('- Complete dataset:', mockContext.performance.completeDataset);
      console.log('- Performance data success:', mockContext.performance.validated_data.success);
      console.log('- Data integrity:', mockContext.performance.validated_data.metadata?.dataIntegrity);
      
      // Step 3: Generate admin scorecard response format
      console.log('\n📋 Step 3: Admin Scorecard Response Format:');
      
      if (mockContext.performance.validated_data.success) {
        const data = mockContext.performance.validated_data.data;
        
        console.log('\n# 🔓 ADMIN COMPLETE SCORECARD: Cody Lanier - August 2025');
        console.log('\n## Core Metrics:');
        console.log(`- **Invoices**: ${data.metrics.invoices}`);
        console.log(`- **Sales**: $${data.metrics.sales.toLocaleString()}`);
        console.log(`- **GP Sales**: $${data.metrics.gpSales.toLocaleString()}`);
        console.log(`- **GP Percent**: ${data.metrics.gpPercent}%`);
        
        console.log('\n## Service Performance:');
        const services = data.services;
        const serviceCategories = {
          'Tires & Alignment': ['Retail Tires', 'All Tires', 'Alignments', 'Tire Balance', 'Tire Rotation', 'Tire Protection'],
          'Fluids & Maintenance': ['Oil Change', 'Coolant Flush', 'Brake Flush', 'Transmission Fluid Service', 'Power Steering Flush'],
          'Brakes & Service': ['Brake Service', 'Battery', 'Engine Air Filter', 'Cabin Air Filter'],
          'Additional Services': ['Fuel System Service', 'Differential Service', 'Belts Replacement', 'Shocks & Struts']
        };
        
        for (const [category, serviceList] of Object.entries(serviceCategories)) {
          console.log(`\n### ${category}:`);
          for (const service of serviceList) {
            const value = services[service];
            if (value !== undefined) {
              const display = typeof value === 'number' ? (value === 0 ? 'N/A' : value.toString()) : (value || 'N/A');
              console.log(`- **${service}**: ${display}`);
            }
          }
        }
        
        console.log('\n## Calculated Metrics:');
        console.log(`- **Tire Protection %**: ${services['Tire Protection %'] || 'N/A'}%`);
        console.log(`- **Potential Alignments %**: ${services['Potential Alignments %'] || 'N/A'}%`);
        console.log(`- **Brake Flush to Service %**: ${services['Brake Flush to Service %'] || 'N/A'}%`);
        console.log(`- **Average Spend**: $${data.metrics.sales && data.metrics.invoices ? (data.metrics.sales / data.metrics.invoices).toFixed(2) : 'N/A'}`);
        
        console.log('\n---');
        console.log('📊 **Admin Note**: Complete dataset retrieved with all available metrics');
        console.log(`🕒 **Data Retrieved**: ${new Date().toISOString()}`);
        console.log(`📅 **Period**: August 2025 MTD`);
      }
      
    } else {
      console.log('❌ Direct API call failed - cannot proceed with AI testing');
      if (directResult.error) {
        console.log('Error:', directResult.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await pool.end();
  }
}

testCompleteAdminScorecard();