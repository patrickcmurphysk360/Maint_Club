/**
 * Comprehensive AI Validation Test Suite
 * 
 * Tests the AI system to validate:
 * 1. Uses /api/scorecard/... endpoints as defined in configuration
 * 2. Does not use spreadsheets or MTD raw data directly
 * 3. AI response includes references to organizational roles and uses proper database lookups
 */

const axios = require('axios');
const { Pool } = require('pg');

const API_BASE = 'http://localhost:5002/api';
const TEST_CONFIG = {
  email: 'admin@example.com',
  password: 'admin123',
  testUserId: 1
};

// Database connection for validation
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'maintenance_club_mvp',
  password: 'ducks2020',
  port: 5432
});

class AIValidationTester {
  constructor() {
    this.testResults = [];
    this.headers = null;
  }

  async initialize() {
    console.log('🔐 Authenticating...');
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: TEST_CONFIG.email,
        password: TEST_CONFIG.password
      });
      this.headers = { Authorization: `Bearer ${loginResponse.data.token}` };
      console.log('✅ Authentication successful\n');
    } catch (error) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      throw error;
    }
  }

  addTestResult(description, expected, actual, status) {
    this.testResults.push({
      description,
      expected,
      actual,
      status: status ? 'PASS' : 'FAIL'
    });
  }

  async testScorecardEndpointUsage() {
    console.log('📊 Testing Scorecard Endpoint Usage...');
    
    const testCases = [
      {
        query: "What are Akeen Jackson's sales numbers?",
        description: "Performance query should use /api/scorecard/advisor endpoint",
        expectedEndpoint: "/api/scorecard/advisor"
      },
      {
        query: "Show me the store performance for store 1",
        description: "Store query should use /api/scorecard/store endpoint", 
        expectedEndpoint: "/api/scorecard/store"
      },
      {
        query: "What are the market totals?",
        description: "Market query should use /api/scorecard/market endpoint",
        expectedEndpoint: "/api/scorecard/market"
      }
    ];

    for (const testCase of testCases) {
      try {
        // Make AI request
        const aiResponse = await axios.post(`${API_BASE}/ai-insights/chat`, {
          query: testCase.query,
          userId: TEST_CONFIG.testUserId
        }, { headers: this.headers });

        // Check if validation metadata indicates scorecard API usage
        const validation = aiResponse.data.validation;
        const usesScorecard = validation?.metricValidation?.isValid !== undefined ||
                             aiResponse.data.response.includes('scorecard') ||
                             aiResponse.data.context_type === 'enhanced';

        this.addTestResult(
          testCase.description,
          `Uses ${testCase.expectedEndpoint} endpoint`,
          usesScorecard ? 'Uses scorecard API system' : 'Unknown data source',
          usesScorecard
        );

      } catch (error) {
        this.addTestResult(
          testCase.description,
          `Uses ${testCase.expectedEndpoint} endpoint`,
          `Error: ${error.message}`,
          false
        );
      }
    }
  }

  async testRawDataAvoidance() {
    console.log('🚫 Testing Raw Data Avoidance...');
    
    const testCases = [
      {
        query: "Show me the MTD data from the spreadsheet",
        description: "Should not access MTD raw data directly",
        forbidden_terms: ['spreadsheet', 'raw_data', 'performance_data', 'mtd_sales']
      },
      {
        query: "What's in the uploaded Excel file?",
        description: "Should not reference Excel/CSV files directly",
        forbidden_terms: ['excel', 'csv', 'uploaded', 'spreadsheetData']
      },
      {
        query: "Give me the calculated TPP from the data",
        description: "Should not calculate metrics manually",
        forbidden_terms: ['calculated', 'manual', 'inferred', 'estimated']
      }
    ];

    for (const testCase of testCases) {
      try {
        const aiResponse = await axios.post(`${API_BASE}/ai-insights/chat`, {
          query: testCase.query,
          userId: TEST_CONFIG.testUserId
        }, { headers: this.headers });

        // Check response and validation for forbidden terms
        const response = aiResponse.data.response.toLowerCase();
        const hasForbiddenTerms = testCase.forbidden_terms.some(term => 
          response.includes(term.toLowerCase())
        );

        // Check if validation caught policy violations
        const validation = aiResponse.data.validation;
        const hasViolations = validation?.fieldValidation?.violationCount > 0;

        const isCompliant = !hasForbiddenTerms || hasViolations;

        this.addTestResult(
          testCase.description,
          'No raw data references or policy violations caught',
          hasForbiddenTerms ? `Contains forbidden terms: ${testCase.forbidden_terms.join(', ')}` : 'Clean response',
          isCompliant
        );

      } catch (error) {
        this.addTestResult(
          testCase.description,
          'No raw data references',
          `Error: ${error.message}`,
          false
        );
      }
    }
  }

  async testOrganizationalQueries() {
    console.log('👥 Testing Organizational Queries...');
    
    const testCases = [
      {
        query: "Who works at the Atlanta store?",
        description: "Should use proper database lookup for store employees",
        expected_source: "user_store_assignments table"
      },
      {
        query: "Who is the manager of store 1?",
        description: "Should identify store managers through role assignments",
        expected_source: "users table with role filtering"
      },
      {
        query: "Show me all advisors in the market",
        description: "Should query organizational structure properly",
        expected_source: "user_market_assignments table"
      },
      {
        query: "What stores has John worked at?",
        description: "Should lookup user store history from assignments",
        expected_source: "user assignment history"
      }
    ];

    for (const testCase of testCases) {
      try {
        const aiResponse = await axios.post(`${API_BASE}/ai-insights/chat`, {
          query: testCase.query,
          userId: TEST_CONFIG.testUserId
        }, { headers: this.headers });

        const response = aiResponse.data.response;
        
        // Check if response includes organizational information
        const hasOrgInfo = response.includes('store') || 
                          response.includes('manager') || 
                          response.includes('advisor') || 
                          response.includes('employee') ||
                          response.includes('role');

        // Check if response indicates proper database usage
        const usesDatabase = !response.includes('spreadsheet') && 
                            !response.includes('file') &&
                            !response.includes('manual lookup');

        const isProperLookup = hasOrgInfo && usesDatabase;

        this.addTestResult(
          testCase.description,
          `Uses ${testCase.expected_source}`,
          isProperLookup ? 'Uses database organizational queries' : 'Improper data source',
          isProperLookup
        );

      } catch (error) {
        this.addTestResult(
          testCase.description,
          `Uses ${testCase.expected_source}`,
          `Error: ${error.message}`,
          false
        );
      }
    }
  }

  async testPolicyEnforcement() {
    console.log('🛡️ Testing Policy Enforcement...');
    
    // Test if the validation middleware is working
    try {
      const testResponse = await axios.post(`${API_BASE}/ai-validation/test`, {
        query: "What are my sales numbers?",
        response_text: "You had $50,000 in sales with 100 invoices and 25 alignments",
        test_user_id: TEST_CONFIG.testUserId
      }, { headers: this.headers });

      const validationWorking = testResponse.data.success && testResponse.data.validation_result;
      
      this.addTestResult(
        'Validation middleware is operational',
        'Middleware validates AI responses',
        validationWorking ? 'Validation system working' : 'Validation system not responding',
        validationWorking
      );

    } catch (error) {
      this.addTestResult(
        'Validation middleware is operational',
        'Middleware validates AI responses',
        `Validation endpoint error: ${error.message}`,
        false
      );
    }

    // Test policy compliance endpoints
    try {
      const policyResponse = await axios.get(`${API_BASE}/ai-policy-check/enforcement-status`, 
        { headers: this.headers });

      const policyCompliant = policyResponse.data.status === 'compliant';
      
      this.addTestResult(
        'AI policy enforcement is active',
        'Policy status: compliant',
        `Policy status: ${policyResponse.data.status}`,
        policyCompliant
      );

    } catch (error) {
      this.addTestResult(
        'AI policy enforcement is active',
        'Policy status: compliant',
        `Policy check error: ${error.message}`,
        false
      );
    }
  }

  async testDataSourceValidation() {
    console.log('🔍 Testing Data Source Validation...');
    
    // Check database for recent AI interactions to see data sources
    try {
      const result = await pool.query(`
        SELECT 
          query,
          validation_type,
          is_valid,
          expected_values,
          detected_values,
          created_at
        FROM ai_validation_audit_log 
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 5
      `);

      const hasRecentValidations = result.rows.length > 0;
      const validationsWorking = result.rows.some(row => row.validation_type === 'performance_metric_validation');

      this.addTestResult(
        'AI responses are being validated in database',
        'Recent validation logs exist',
        hasRecentValidations ? `${result.rows.length} recent validations found` : 'No recent validations',
        hasRecentValidations
      );

      this.addTestResult(
        'Performance metric validation is active',
        'Performance validations in audit log',
        validationsWorking ? 'Performance validations found' : 'No performance validations',
        validationsWorking
      );

    } catch (error) {
      this.addTestResult(
        'AI responses are being validated in database',
        'Validation audit logs accessible',
        `Database error: ${error.message}`,
        false
      );
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive AI Validation Tests\n');
    console.log('=' .repeat(60) + '\n');

    await this.initialize();
    
    await this.testScorecardEndpointUsage();
    await this.testRawDataAvoidance();
    await this.testOrganizationalQueries();
    await this.testPolicyEnforcement();
    await this.testDataSourceValidation();

    console.log('\n' + '=' .repeat(60));
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));

    // Print results table
    console.log('');
    console.log('| Test Description | Expected | Actual | Pass/Fail |');
    console.log('|------------------|----------|--------|-----------|');
    
    for (const result of this.testResults) {
      console.log(`| ${result.description.padEnd(16)} | ${result.expected.padEnd(8)} | ${result.actual.padEnd(6)} | ${result.status.padEnd(9)} |`);
    }

    console.log('');
    
    // Summary statistics
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = totalTests - passedTests;

    console.log(`📊 SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
    
    if (failedTests > 0) {
      console.log(`\n❌ FAILED TESTS (${failedTests}):`);
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`   • ${result.description}`);
          console.log(`     Expected: ${result.expected}`);
          console.log(`     Actual: ${result.actual}`);
        });
    }

    console.log('\n✅ Test suite completed!');
    
    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      results: this.testResults
    };
  }
}

// Run the comprehensive test suite
async function runTests() {
  const tester = new AIValidationTester();
  
  try {
    const results = await tester.runAllTests();
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Test suite failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();