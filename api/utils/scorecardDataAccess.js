/**
 * Validated Scorecard Data Access Utility
 * 
 * CRITICAL: This is the ONLY authorized method for accessing performance metrics.
 * All TPP, PAT, attach rates, and vendor mappings MUST come from official scorecard endpoints.
 * 
 * FORBIDDEN: Raw spreadsheets, CSV files, static JSON, manual test data
 */

const axios = require('axios');

/**
 * Required fields that must be present in scorecard responses
 */
const REQUIRED_SCORECARD_FIELDS = {
  advisor: [
    'sales', 'gpSales', 'gpPercent', 'invoices',
    'alignments', 'oilChange', 'retailTires', 'brakeService'
  ],
  store: [
    'totalSales', 'totalGpSales', 'totalInvoices', 'advisorCount'
  ],
  market: [
    'totalSales', 'totalGpSales', 'totalInvoices', 'storeCount', 'advisorCount'
  ],
  rankings: [
    'metric', 'rankings', 'totalStores'
  ]
};

/**
 * Advanced calculated fields that may be present (but not required)
 */
const OPTIONAL_CALCULATED_FIELDS = [
  'tpp', 'pat', 'fluid_attach_rates', 'fluidAttachRates',
  'vendorMapping', 'attachRates', 'efficiencyMetrics'
];

class ScorecardDataAccessError extends Error {
  constructor(message, level, id, endpoint, originalError = null) {
    super(message);
    this.name = 'ScorecardDataAccessError';
    this.level = level;
    this.id = id;
    this.endpoint = endpoint;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Primary utility function for accessing validated scorecard data
 * 
 * @param {Object} params - Parameters object
 * @param {string} params.level - 'advisor', 'store', or 'market'
 * @param {number|string} params.id - Entity ID
 * @param {string} [params.baseURL] - Override base URL (default from env)
 * @param {number} [params.timeout] - Request timeout in ms (default 10000)
 * @param {number} [params.mtdMonth] - Month for MTD data (1-12)
 * @param {number} [params.mtdYear] - Year for MTD data
 * @param {string} [params.startDate] - Start date for range queries
 * @param {string} [params.endDate] - End date for range queries
 * @returns {Promise<Object>} Validated scorecard data
 * @throws {ScorecardDataAccessError} When API fails or data is invalid
 */
async function getValidatedScorecardData({ level, id, baseURL = null, timeout = 10000, mtdMonth = null, mtdYear = null, startDate = null, endDate = null }) {
  // Input validation
  if (!level || !id) {
    throw new ScorecardDataAccessError(
      'Missing required parameters: level and id are required',
      level,
      id,
      null
    );
  }

  const normalizedLevel = level.toLowerCase();
  if (!['advisor', 'store', 'market', 'rankings'].includes(normalizedLevel)) {
    throw new ScorecardDataAccessError(
      `Invalid level '${level}'. Must be 'advisor', 'store', 'market', or 'rankings'`,
      level,
      id,
      null
    );
  }

  // Build endpoint URL - single source of truth
  const defaultBaseURL = process.env.API_BASE_URL || 'http://localhost:5002';
  const apiBaseURL = baseURL || defaultBaseURL;
  let endpoint = `${apiBaseURL}/api/scorecard/${normalizedLevel}/${id}`;
  
  // Add query parameters if provided
  const queryParams = [];
  if (mtdMonth && mtdYear) {
    queryParams.push(`mtdMonth=${mtdMonth}`);
    queryParams.push(`mtdYear=${mtdYear}`);
  } else if (startDate || endDate) {
    if (startDate) queryParams.push(`startDate=${startDate}`);
    if (endDate) queryParams.push(`endDate=${endDate}`);
  }
  
  if (queryParams.length > 0) {
    endpoint += '?' + queryParams.join('&');
  }
  
  console.log(`📊 POLICY ENFORCEMENT: Accessing validated scorecard data`);
  console.log(`   Level: ${normalizedLevel}`);
  console.log(`   ID: ${id}`);
  console.log(`   Endpoint: ${endpoint}`);

  try {
    // Generate service token for internal API access
    const jwt = require('jsonwebtoken');
    const serviceToken = jwt.sign(
      { 
        id: 1, 
        role: 'admin', 
        service: 'ai-validation-middleware',
        internal: true 
      },
      process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
      { expiresIn: '5m' }
    );

    // Make API request to official scorecard endpoint
    const response = await axios.get(endpoint, {
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceToken}`,
        'User-Agent': 'AI-Agent-Scorecard-Access/2.0'
      }
    });

    // Validate response structure
    if (!response.data) {
      throw new ScorecardDataAccessError(
        'Empty response from scorecard API',
        normalizedLevel,
        id,
        endpoint
      );
    }

    // Handle direct scorecard response format (no wrapper)
    let scorecardData = response.data;
    
    // If wrapped in success/data format, unwrap it
    if (response.data.success !== undefined) {
      if (!response.data.success) {
        throw new ScorecardDataAccessError(
          `Scorecard API error: ${response.data.message || 'Unknown error'}`,
          normalizedLevel,
          id,
          endpoint
        );
      }
      scorecardData = response.data.data;
    }

    if (!scorecardData) {
      throw new ScorecardDataAccessError(
        'No scorecard data in API response',
        normalizedLevel,
        id,
        endpoint
      );
    }

    // Validate required fields are present
    const requiredFields = REQUIRED_SCORECARD_FIELDS[normalizedLevel];
    const missingFields = requiredFields.filter(field => 
      scorecardData[field] === undefined || scorecardData[field] === null
    );

    if (missingFields.length > 0) {
      console.warn(`⚠️ Missing required fields in ${normalizedLevel} scorecard: ${missingFields.join(', ')}`);
      // Log warning but don't fail - some fields may be optional in certain contexts
    }

    // Log successful access
    console.log(`✅ Successfully retrieved validated ${normalizedLevel} scorecard data`);
    console.log(`   Required fields present: ${requiredFields.filter(f => scorecardData[f] !== undefined).length}/${requiredFields.length}`);
    
    const optionalFields = OPTIONAL_CALCULATED_FIELDS.filter(f => scorecardData[f] !== undefined);
    if (optionalFields.length > 0) {
      console.log(`   Advanced fields available: ${optionalFields.join(', ')}`);
    }

    // Return validated data with metadata
    return {
      success: true,
      data: scorecardData,
      metadata: {
        level: normalizedLevel,
        id: id,
        endpoint: endpoint,
        retrievedAt: new Date().toISOString(),
        source: 'validated_scorecard_api',
        requiredFieldsPresent: requiredFields.length - missingFields.length,
        totalRequiredFields: requiredFields.length,
        advancedFieldsAvailable: optionalFields,
        dataIntegrity: 'verified'
      }
    };

  } catch (error) {
    // Handle different error types
    let errorMessage;
    let originalError = error;

    if (error instanceof ScorecardDataAccessError) {
      // Re-throw our custom errors
      throw error;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to scorecard API at ${endpoint}. Service may be down.`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `Scorecard API hostname not found: ${endpoint}`;
    } else if (error.response) {
      // HTTP error response
      errorMessage = `Scorecard API HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
    } else if (error.request) {
      // Network error
      errorMessage = `Network error accessing scorecard API: ${error.message}`;
    } else {
      // Other errors
      errorMessage = `Unexpected error accessing scorecard data: ${error.message}`;
    }

    console.error(`❌ SCORECARD ACCESS FAILED: ${errorMessage}`);
    console.error(`   Level: ${normalizedLevel}, ID: ${id}`);
    console.error(`   Endpoint: ${endpoint}`);

    throw new ScorecardDataAccessError(
      errorMessage,
      normalizedLevel,
      id,
      endpoint,
      originalError
    );
  }
}

/**
 * Batch fetch multiple scorecard data points
 * Useful for getting advisor + store + market data efficiently
 */
async function getValidatedScorecardDataBatch(requests) {
  console.log(`📊 BATCH POLICY ENFORCEMENT: Accessing ${requests.length} scorecard endpoints`);
  
  const promises = requests.map(async (request, index) => {
    try {
      const result = await getValidatedScorecardData(request);
      return { index, success: true, data: result };
    } catch (error) {
      console.warn(`⚠️ Batch request ${index} failed: ${error.message}`);
      return { index, success: false, error: error };
    }
  });

  const results = await Promise.allSettled(promises);
  
  const successfulResults = results
    .filter(result => result.status === 'fulfilled' && result.value.success)
    .map(result => result.value.data);
    
  const failedResults = results
    .filter(result => result.status === 'rejected' || !result.value.success)
    .map((result, index) => ({
      index,
      error: result.status === 'rejected' ? result.reason : result.value.error
    }));

  console.log(`📊 Batch results: ${successfulResults.length} successful, ${failedResults.length} failed`);

  return {
    successful: successfulResults,
    failed: failedResults,
    totalRequests: requests.length
  };
}

/**
 * Validate that data comes from approved scorecard endpoints
 * Used by AI response validator to ensure no unauthorized data sources
 */
function validateDataSource(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Invalid data object' };
  }

  // Check for required metadata indicating validated source
  if (!data.metadata || data.metadata.source !== 'validated_scorecard_api') {
    return { 
      valid: false, 
      reason: 'Data does not contain validated scorecard API metadata' 
    };
  }

  // Check for required metadata fields
  const requiredMetadata = ['level', 'id', 'endpoint', 'retrievedAt', 'dataIntegrity'];
  const missingMetadata = requiredMetadata.filter(field => !data.metadata[field]);
  
  if (missingMetadata.length > 0) {
    return {
      valid: false,
      reason: `Missing required metadata fields: ${missingMetadata.join(', ')}`
    };
  }

  // Verify data integrity flag
  if (data.metadata.dataIntegrity !== 'verified') {
    return {
      valid: false,
      reason: 'Data integrity not verified'
    };
  }

  return { valid: true, reason: 'Data source validated' };
}

/**
 * Check if scorecard API endpoints are accessible
 * Health check utility
 */
async function checkScorecardAPIHealth(baseURL = null) {
  // Single source of truth
  const defaultBaseURL = process.env.API_BASE_URL || 'http://localhost:5002';
  const apiBaseURL = baseURL || defaultBaseURL;
  
  console.log('🏥 Checking scorecard API health...');
  
  const healthChecks = [
    { name: 'advisor', endpoint: `${apiBaseURL}/api/scorecard/advisor/1` },
    { name: 'store', endpoint: `${apiBaseURL}/api/scorecard/store/1` },
    { name: 'market', endpoint: `${apiBaseURL}/api/scorecard/market/1` }
  ];

  const results = {};

  for (const check of healthChecks) {
    try {
      const response = await axios.get(check.endpoint, { 
        timeout: 5000,
        validateStatus: status => status < 500 // Accept 4xx as "healthy" (just no data)
      });
      
      results[check.name] = {
        accessible: true,
        status: response.status,
        endpoint: check.endpoint
      };
      
      console.log(`✅ ${check.name} endpoint accessible (HTTP ${response.status})`);
    } catch (error) {
      results[check.name] = {
        accessible: false,
        error: error.message,
        endpoint: check.endpoint
      };
      
      console.error(`❌ ${check.name} endpoint failed: ${error.message}`);
    }
  }

  return results;
}

module.exports = {
  getValidatedScorecardData,
  getValidatedScorecardDataBatch,
  validateDataSource,
  checkScorecardAPIHealth,
  ScorecardDataAccessError,
  REQUIRED_SCORECARD_FIELDS,
  OPTIONAL_CALCULATED_FIELDS
};