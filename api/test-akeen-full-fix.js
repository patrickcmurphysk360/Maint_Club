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

async function testAkeenFullFix() {
  try {
    console.log('🔍 AKEEN JACKSON FULL DIAGNOSTIC...\n');
    
    // Step 1: Test user lookup with name variations
    console.log('👤 Step 1: Testing user lookup variations...');
    const nameVariations = ['akeen jackson', 'akeem jackson', 'akiem jackson'];
    
    for (const name of nameVariations) {
      const result = await pool.query(`
        SELECT id, first_name, last_name, email, role, status
        FROM users 
        WHERE (LOWER(first_name) LIKE $1 AND LOWER(last_name) LIKE $2)
           OR (LOWER(first_name || ' ' || last_name) LIKE $3)
        LIMIT 5
      `, [`%${name.split(' ')[0]}%`, `%${name.split(' ')[1]}%`, `%${name}%`]);
      
      console.log(`  "${name}": ${result.rows.length} matches`);
      if (result.rows.length > 0) {
        result.rows.forEach(user => {
          console.log(`    - ${user.first_name} ${user.last_name} (ID: ${user.id}, Email: ${user.email})`);
        });
      }
    }
    
    // Step 2: Test AI user identification
    console.log('\n🤖 Step 2: Testing AI user identification...');
    const aiService = new AIDataService(pool);
    const testQuery = "provide me the scorecard for akeen jackson";
    
    console.log(`Query: "${testQuery}"`);
    
    // Extract names using AI logic
    const { extractPotentialNames, lookupUserByName } = require('./utils/userIdentification');
    const namePatterns = extractPotentialNames(testQuery);
    console.log('Extracted patterns:', namePatterns);
    
    if (namePatterns.length > 0) {
      const identifiedUser = await lookupUserByName(pool, namePatterns);
      if (identifiedUser) {
        console.log(`✅ AI identified: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
        
        // Step 3: Test API server accessibility
        console.log('\n📡 Step 3: Testing API server...');
        
        const axios = require('axios');
        try {
          const healthCheck = await axios.get('http://localhost:5000/health', { timeout: 3000 });
          console.log('✅ API server is running:', healthCheck.status);
          
          // Step 4: Test scorecard API directly
          console.log('\n📊 Step 4: Testing scorecard API...');
          
          const jwt = require('jsonwebtoken');
          const adminToken = jwt.sign(
            { id: 1, role: 'admin', service: 'ai-validation-middleware', internal: true },
            process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
            { expiresIn: '10m' }
          );
          
          const scorecardResponse = await axios.get(
            `http://localhost:5000/api/scorecard/advisor/${identifiedUser.id}`,
            {
              headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );
          
          console.log('✅ Scorecard API response:', {
            status: scorecardResponse.status,
            userId: scorecardResponse.data.userId,
            invoices: scorecardResponse.data.metrics?.invoices,
            sales: scorecardResponse.data.metrics?.sales,
            serviceCount: scorecardResponse.data.services ? Object.keys(scorecardResponse.data.services).length : 0
          });
          
          // Step 5: Test AI context building
          console.log('\n🔄 Step 5: Testing AI context building...');
          const context = await aiService.buildComprehensiveContext(1, testQuery); // Admin user ID = 1
          
          console.log('Context results:');
          console.log('- Performance query detected:', context.performance?.is_performance_query);
          console.log('- Specific person query:', context.performance?.is_specific_person_query);
          console.log('- Person name:', context.performance?.specific_person_name);
          console.log('- Validated data success:', context.performance?.validated_data?.success);
          
          if (context.performance?.validated_data?.success) {
            const data = context.performance.validated_data.data;
            console.log('\n🎯 COMPLETE AKEEN JACKSON SCORECARD:');
            console.log(`**User ID**: ${data.userId}`);
            console.log(`**Invoices**: ${data.metrics.invoices}`);
            console.log(`**Sales**: $${data.metrics.sales.toLocaleString()}`);
            console.log(`**GP Sales**: $${data.metrics.gpSales.toLocaleString()}`);
            console.log(`**GP Percent**: ${data.metrics.gpPercent}%`);
            
            console.log('\n**Key Services**:');
            const keyServices = ['Oil Change', 'Alignments', 'Retail Tires', 'Brake Service', 'All Tires'];
            keyServices.forEach(service => {
              const value = data.services[service];
              console.log(`- **${service}**: ${value !== undefined ? value : 'N/A'}`);
            });
            
            console.log('\n**Calculated Metrics**:');
            console.log(`- **Tire Protection %**: ${data.services['Tire Protection %'] || 'N/A'}%`);
            console.log(`- **Potential Alignments %**: ${data.services['Potential Alignments %'] || 'N/A'}%`);
            console.log(`- **Average Spend**: $${data.metrics.sales && data.metrics.invoices ? (data.metrics.sales / data.metrics.invoices).toFixed(2) : 'N/A'}`);
            
          } else {
            console.log('❌ AI context building failed');
            console.log('Error:', context.performance?.validated_data?.error);
          }
          
        } catch (apiError) {
          console.log('❌ API server error:', apiError.message);
          console.log('Code:', apiError.code);
          
          if (apiError.code === 'ECONNREFUSED') {
            console.log('\n🚨 API SERVER NOT RUNNING');
            console.log('Please start the server: cd api && npm run dev');
          }
        }
        
      } else {
        console.log('❌ AI could not identify user from patterns');
      }
    } else {
      console.log('❌ No name patterns extracted from query');
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  } finally {
    await pool.end();
  }
}

testAkeenFullFix();