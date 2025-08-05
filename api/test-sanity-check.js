/**
 * Test that sanity check catches mock data
 */

const ollamaService = require('./services/ollamaService');
const { Pool } = require('pg');

async function testSanityCheck() {
  console.log('🧪 Testing Sanity Check for Mock Data Detection');
  console.log('=' .repeat(60));
  
  const pool = new Pool({
    user: 'admin',
    host: 'localhost', 
    database: 'maintenance_club_mvp',
    password: 'ducks2020',
    port: 5432,
  });
  
  const ollama = new ollamaService(pool);
  
  try {
    // Create fake context with high sales (mock data)
    const fakeContext = {
      performance: {
        validated_data: {
          success: true,
          data: {
            metrics: {
              sales: 316245, // This should trigger sanity check
              invoices: 515,
              gpSales: 147431
            }
          }
        }
      }
    };
    
    console.log('Testing with fake high sales value: $316,245');
    
    // This should throw an error due to sanity check
    const result = ollama.generateAdminScorecardPrompt('test query', fakeContext);
    
    console.log('❌ FAILURE: Sanity check did not catch mock data!');
    console.log('Result:', result);
    
  } catch (error) {
    if (error.message.includes('Sanity check failed')) {
      console.log('✅ SUCCESS: Sanity check caught mock data!');
      console.log('Error message:', error.message);
    } else {
      console.log('❌ UNEXPECTED ERROR:', error.message);
    }
  } finally {
    await pool.end();  
  }
}

testSanityCheck();