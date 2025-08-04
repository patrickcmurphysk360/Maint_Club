const AIDataService = require('./services/aiDataService');
const { Pool } = require('pg');
const pool = new Pool({host: 'localhost', port: 5432, database: 'maintenance_club_mvp', user: 'admin', password: 'ducks2020'});

async function testSpecificQuery() {
  console.log('🔍 Testing Specific Problematic Query\n');
  
  const aiDataService = new AIDataService(pool);
  
  const query = 'provide me with akeen jacksons august 2025 score card';
  console.log(`Query: "${query}"`);
  
  const lowerQuery = query.toLowerCase();
  console.log(`Lowercase: "${lowerQuery}"`);
  
  try {
    // Test the new "provide" pattern specifically
    console.log('\nTesting updated provide pattern:');
    const providePattern = /(?:provide\s+(?:me\s+(?:with\s+)?)?)\s*([a-zA-Z\s]+?)(?:s)?\s+(?:[\d\s,]+\s+)?(?:complete\s+)?(?:scorecard|score\s+card|metrics|performance|breakdown)/i;
    const provideMatch = lowerQuery.match(providePattern);
    console.log(`Pattern: ${providePattern}`);
    console.log(`Match: ${provideMatch ? `"${provideMatch[1]}"` : 'NO MATCH'}`);
    
    if (provideMatch) {
      let personName = provideMatch[1].trim();
      console.log(`Raw name: "${personName}"`);
      
      // Apply the same cleanup logic as the actual code
      personName = personName.replace(/\b(akeem|akiem)\b/gi, 'akeen'); // Handle spelling variations first
      
      // Remove date-related words FIRST (months, years, "mtd", etc.)
      personName = personName.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '');
      personName = personName.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi, '');
      personName = personName.replace(/\b(20\d{2}|19\d{2})\b/g, ''); // Remove years
      personName = personName.replace(/\b(mtd|month|quarterly|yearly)\b/gi, '');
      personName = personName.trim().replace(/\s+/g, ' '); // Clean up extra spaces
      
      // THEN handle possessive forms after dates are removed
      if (personName.endsWith('ns') && !personName.endsWith('sons') && !personName.endsWith('mans')) {
        personName = personName.replace(/ns$/, 'n'); // "jacksons" -> "jackson"
      } else if (personName.endsWith('s') && !personName.endsWith('ss')) {
        personName = personName.replace(/s$/, ''); // Generic possessive cleanup
      }
      
      console.log(`Cleaned name: "${personName}"`);
    }
    
    // Test the full AI context building
    console.log('\nTesting full AI context:');
    const context = await aiDataService.buildComprehensiveContext(1, query);
    console.log(`Detected: ${context.performance.is_specific_person_query ? `"${context.performance.specific_person_name}"` : 'NOT DETECTED'}`);
    
    if (context.performance.is_specific_person_query && context.performance.latest) {
      console.log('✅ SUCCESS! Data retrieved:');
      console.log(`  Sales: $${context.performance.latest.sales?.toLocaleString()}`);
      console.log(`  GP: ${context.performance.latest.gpPercent}%`);
      console.log(`  Alignments: ${context.performance.latest.alignments}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing query:', error);
  } finally {
    await pool.end();
  }
}

testSpecificQuery();