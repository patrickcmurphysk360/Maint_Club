const AIDataService = require('./services/aiDataService');
const OllamaService = require('./services/ollamaService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testCodyLanier() {
  console.log('🔍 Testing Cody Lanier Data Access\n');
  
  const aiDataService = new AIDataService(pool);
  const ollamaService = new OllamaService(pool);
  
  try {
    const query = "what is cody lanier's total retail tires sold for august 2025";
    console.log(`Query: "${query}"`);
    
    // First, search for Cody Lanier in the database
    console.log('\n1. Searching for Cody Lanier in users table...');
    const userSearch = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, s.name as store_name, m.name as market_name
      FROM users u
      LEFT JOIN user_store_assignments usa ON u.id::text = usa.user_id
      LEFT JOIN stores s ON usa.store_id::integer = s.id
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE LOWER(u.first_name || ' ' || u.last_name) LIKE '%cody%lanier%'
         OR LOWER(u.first_name || ' ' || u.last_name) LIKE '%lanier%cody%'
    `);
    
    if (userSearch.rows.length > 0) {
      console.log('✅ Found Cody Lanier:');
      userSearch.rows.forEach(user => {
        console.log(`   ID: ${user.id}, Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Store: ${user.store_name}, Market: ${user.market_name}`);
      });
      
      const codyId = userSearch.rows[0].id;
      
      // Check for performance data
      console.log('\n2. Checking performance_data for August 2025...');
      const performanceResult = await pool.query(`
        SELECT 
          pd.upload_date,
          pd.data,
          s.name as store_name
        FROM performance_data pd
        LEFT JOIN stores s ON pd.store_id = s.id
        WHERE pd.advisor_user_id = $1
          AND EXTRACT(YEAR FROM pd.upload_date) = 2025
          AND EXTRACT(MONTH FROM pd.upload_date) = 8
        ORDER BY pd.upload_date DESC
      `, [codyId]);
      
      console.log(`Found ${performanceResult.rows.length} performance records for August 2025:`);
      
      if (performanceResult.rows.length > 0) {
        const latestRecord = performanceResult.rows[0];
        const data = latestRecord.data;
        console.log(`✅ Latest record (${new Date(latestRecord.upload_date).toLocaleDateString()}):`);
        console.log(`   Retail Tires: ${data.retailTires || 'N/A'} units`);
        console.log(`   Sales: $${data.sales?.toLocaleString() || 'N/A'}`);
        console.log(`   Store: ${latestRecord.store_name}`);
        
        // Show all retail tire data for the month
        console.log('\n   All August 2025 retail tire records:');
        performanceResult.rows.forEach((record, index) => {
          const date = new Date(record.upload_date).toLocaleDateString();
          const tires = record.data.retailTires || 0;
          console.log(`   ${index + 1}. ${date}: ${tires} retail tires`);
        });
      } else {
        console.log('❌ No performance data found for Cody Lanier in August 2025');
      }
    } else {
      console.log('❌ Cody Lanier not found in users table');
    }
    
    // Test AI context building
    console.log('\n3. Testing AI context building...');
    const context = await aiDataService.buildComprehensiveContext(1, query);
    
    console.log(`AI Detection: ${context.performance.is_specific_person_query ? `"${context.performance.specific_person_name}"` : 'NOT DETECTED'}`);
    
    if (context.performance.is_specific_person_query && context.performance.latest) {
      console.log('✅ AI Context Data:');
      console.log(`   Retail Tires: ${context.performance.latest.retailTires || 'N/A'}`);
      console.log(`   Sales: $${context.performance.latest.sales?.toLocaleString() || 'N/A'}`);
    }
    
    // Generate AI prompt to see what data is being sent
    console.log('\n4. AI Prompt Analysis...');
    const prompt = ollamaService.generateEnhancedPrompt(query, context);
    
    // Look for retail tire mentions
    const retailTireMatches = prompt.match(/retail\s*tires?:?\s*(\d+)/gi);
    if (retailTireMatches) {
      console.log('✅ Retail tire data found in prompt:');
      retailTireMatches.forEach(match => console.log(`   ${match}`));
    } else {
      console.log('❌ No retail tire data found in AI prompt');
    }
    
    // Check for confusing sales data
    const salesMatches = prompt.match(/\$[\d,]+/g);
    if (salesMatches) {
      console.log('⚠️ Sales figures in prompt (potential confusion):');
      salesMatches.forEach(match => console.log(`   ${match}`));
    }
    
  } catch (error) {
    console.error('❌ Error testing Cody Lanier:', error);
  } finally {
    await pool.end();
  }
}

testCodyLanier();