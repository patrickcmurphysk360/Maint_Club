/**
 * Debug Scorecard JSON Formatting
 */

const OllamaService = require('./services/ollamaService');

const ollamaService = new OllamaService();

// Mock scorecard data
const mockScorecardData = {
  advisor: 'Cody Lanier',
  month: 'August',
  store: 'McDonough',
  metrics: {
    sales: 12500,
    gpSales: 3200,
    gpPercent: 25.6,
    invoices: 16
  },
  services: {
    'Oil Change': 16,
    'Alignments': 2,
    'Retail Tires': 12,
    'All Tires': 15,
    'Brake Service': 1,
    'Tire Protection': 8
  },
  goals: {
    'Oil Change': { target: 20, periodType: 'monthly' },
    'Alignments': { target: 4, periodType: 'monthly' }
  }
};

console.log('🔍 Debugging Scorecard JSON Formatting');
console.log('=' .repeat(50));

console.log('📊 Input Data:');
console.log(JSON.stringify(mockScorecardData, null, 2));
console.log('');

try {
  const formattedJson = ollamaService.formatAdminScorecardData(mockScorecardData);
  console.log('✅ Formatted JSON:');
  console.log(formattedJson);
  console.log('');
  
  // Test parsing
  const parsed = JSON.parse(formattedJson);
  console.log('✅ Parsed JSON successfully');
  console.log('- Advisor:', parsed.advisor);
  console.log('- Metrics keys:', Object.keys(parsed.metrics));
  console.log('- Services keys:', Object.keys(parsed.services));
  console.log('- Goals keys:', Object.keys(parsed.goals));
  
} catch (error) {
  console.error('❌ JSON formatting/parsing failed:', error.message);
}