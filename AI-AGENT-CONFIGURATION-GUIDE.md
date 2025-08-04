# AI Agent Configuration Guide

**Last Updated:** August 4, 2025  
**Version:** 2.0 - Scorecard API Integration & Validation Layer

## Overview

The AI agent provides intelligent insights and answers to business questions using **validated data sources only**. This guide outlines the strict data governance, validation mechanisms, and architectural constraints that ensure data accuracy and prevent the use of unvalidated sources.

## 🔒 Critical Data Governance Rules

### **APPROVED DATA SOURCES**

#### **1. Performance Data - SCORECARD API ONLY**
All performance metrics MUST come from these validated endpoints:

```
✅ /api/scorecard/advisor/:userId    - Individual advisor performance
✅ /api/scorecard/store/:storeId     - Store-level aggregated performance  
✅ /api/scorecard/market/:marketId   - Market-level aggregated performance
```

**Approved Performance Fields:**
- `sales`, `gpSales`, `gpPercent`, `invoices`
- `alignments`, `oilChange`, `retailTires`, `brakeService`
- `tpp`, `pat` (calculated by scorecard system)
- `fluid_attach_rates` (complex object from scorecard system)
- Metadata: `store_name`, `market_name`, `advisor_name`, `period`

#### **2. Organizational Data - DATABASE LOOKUPS ONLY**
All organizational information comes from validated database relationships:

```sql
✅ users + user_store_assignments + user_market_assignments
✅ stores + markets (for location data)
✅ Proper JOIN operations using assignment tables
```

### **FORBIDDEN DATA SOURCES & BEHAVIORS**

#### **❌ Raw Spreadsheet Data**
- Never use `performance_data` table directly for metrics
- No access to `avgSpend`, `mtdSales`, `rawData`, `spreadsheetData`
- No MTD upload files or raw performance imports

#### **❌ Inferred or Calculated Metrics**
- Never calculate TPP, PAT, or fluid attach rates
- No approximations like `calculatedTPP`, `inferredPAT`
- No estimated metrics like `estimatedAttachRate`

#### **❌ Organizational Inference**
- Never infer org structure from performance data
- No extraction of manager/store info from spreadsheets
- Must use official assignment tables only

## 🏗️ System Architecture

### **AI Data Service** (`aiDataService.js`)

**Core Methods:**
```javascript
// NEW: Primary method for performance data
getValidatedScorecardResponse(targetType, targetId, contextUserId)

// Performance intent detection
detectPerformanceIntent(query) 

// Organizational lookups (unchanged)
getUserContext(userId)
getStoreEmployees(storeId, storeName)
getOrganizationalStructure(marketId)

// DEPRECATED: Legacy method (warns when used)
getPerformanceData(userId, limit) // ⚠️ Use getValidatedScorecardResponse instead
```

**Query Flow:**
1. **Intent Detection**: `detectPerformanceIntent()` identifies performance queries
2. **Data Routing**: Performance queries → `getValidatedScorecardResponse()` → scorecard API
3. **Organizational Routing**: Non-performance queries → database lookups
4. **Context Building**: Validated data with clear source attribution

### **Ollama Service** (`ollamaService.js`)

**Enhanced Features:**
- Integrated `ScorecardFieldValidator` for response validation
- Updated prompt templates with strict data source rules
- Response interception and sanitization
- Validation metadata in all responses

### **Scorecard Field Validator** (`scorecardFieldValidator.js`)

**Key Responsibilities:**
- Validates AI responses against approved field whitelist
- Detects forbidden field usage (raw spreadsheet data)
- Logs violations with full context
- Sanitizes responses with warning messages for violations

## 🛡️ Validation & Monitoring System

### **Response Validation Pipeline**

```javascript
// Automatic validation for performance queries
if (shouldValidate(query, contextData)) {
  const validation = await scorecardValidator.validateResponse(
    aiResponse, userId, query, contextData
  );
  
  // Add validation metadata
  response.validation = {
    status: validation.isValid ? 'passed' : 'failed',
    violations: validation.violationCount,
    approved_fields: validation.approvedFieldCount
  };
}
```

### **Violation Logging** (`ai_scorecard_violations` table)

**Logged Information:**
- User ID and original query
- Detected violations with field names and types
- Severity levels: `low`, `medium`, `high`, `critical`
- Response excerpts containing violations
- Timestamps for trend analysis

**Violation Types:**
- `forbidden_field` - Use of explicitly banned fields
- `unapproved_performance_field` - Performance field not in whitelist
- `invalid_data_source` - Performance metrics without scorecard API source
- `system_error` - Validation system failures

### **Management Endpoints** (`/api/ai-validation/`)

```
GET /stats                 - Validation statistics (admin only)
GET /violations           - Recent violations (users see own, admins see all)
GET /violated-fields      - Most frequently violated fields (admin only)
GET /approved-fields      - Reference whitelist (all users)
POST /test               - Test validation on sample text (admin only)
GET /dashboard           - Comprehensive validation overview (admin only)
```

## 🔧 Configuration & Environment

### **Environment Variables**

```bash
# AI Service Configuration
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b
API_BASE_URL=http://localhost:5000

# Validation Settings
ENABLE_SCORECARD_VALIDATION=true
LOG_VALIDATION_VIOLATIONS=true
VALIDATION_STRICTNESS=high  # low, medium, high, critical
```

### **Database Setup**

**Required Migration:**
```bash
psql -d maintenance_club_mvp -f database-scripts/07-scorecard-validation-logging.sql
```

**Key Tables:**
- `ai_scorecard_violations` - Violation logging
- `scorecard_violation_stats` - Daily statistics view
- `get_top_violated_fields()` - Function for violation analysis

## 📋 API Usage Examples

### **Performance Query (Validated)**

```javascript
// Request
POST /api/ai-insights/chat
{
  "query": "What were John's sales last month?",
  "userId": 123
}

// Response
{
  "query": "What were John's sales last month?",
  "response": "Based on validated scorecard data, John's sales were $45,230...",
  "validation": {
    "status": "passed",
    "violations": 0,
    "approved_fields": 3
  },
  "context_type": "enhanced"
}
```

### **Organizational Query**

```javascript
// Request  
POST /api/ai-insights/chat
{
  "query": "Who works at the downtown store?",
  "userId": 123
}

// Response - Uses database lookups, no scorecard validation needed
{
  "query": "Who works at the downtown store?",
  "response": "The downtown store has 5 employees: John Smith (manager)...",
  "context_type": "enhanced"
}
```

## 🚨 Development & Debugging

### **Debug Flags**

```javascript
// Enable detailed validation logging
process.env.DEBUG_SCORECARD_VALIDATION = 'true'

// Show all field extractions
process.env.DEBUG_FIELD_EXTRACTION = 'true'

// Log all AI context building
process.env.DEBUG_AI_CONTEXT = 'true'
```

### **Console Monitoring**

**Validation Success:**
```
✅ Scorecard validation passed for user 123
   Approved fields used: sales, gpPercent, tpp
```

**Validation Failure:**
```
⚠️ Scorecard validation FAILED for user 123
   HIGH: Use of forbidden field 'rawSales' detected
   MEDIUM: Use of unapproved performance field 'avgTicket'
```

**Data Source Verification:**
```
📊 Getting VALIDATED scorecard data for John Smith (ID: 123)
🔗 Fetching advisor scorecard from: http://localhost:5000/api/scorecard/advisor/123
✅ Successfully retrieved validated advisor scorecard
```

### **Common Issues & Solutions**

#### **Issue: AI referencing raw spreadsheet data**
**Solution:** Check that `detectPerformanceIntent()` is properly identifying the query type and routing to scorecard endpoints.

#### **Issue: High violation counts**
**Solution:** Review AI prompt templates in `ollamaService.js` - ensure they emphasize scorecard API usage only.

#### **Issue: Organizational data mixed with performance**
**Solution:** Verify `isPerformanceQuery` flag is properly set to prevent organizational queries from accessing performance data.

## 🔄 Data Flow Summary

### **Performance Queries:**
1. Query → `detectPerformanceIntent()` → `true`
2. Route to `getValidatedScorecardResponse()`
3. Call appropriate `/api/scorecard/*` endpoint
4. Build context with `validated_data` field
5. Generate AI response with scorecard-only prompts
6. Validate response against field whitelist
7. Log violations (if any)
8. Return response with validation metadata

### **Organizational Queries:**
1. Query → `detectPerformanceIntent()` → `false`
2. Route to `analyzeOrganizationalQuery()`
3. Use database lookups with proper JOINs
4. Build context with organizational data
5. Generate AI response (no scorecard validation needed)
6. Return response

## 📊 Monitoring & Maintenance

### **Regular Monitoring Tasks**

1. **Weekly Violation Review:**
   - Check `/api/ai-validation/dashboard`
   - Identify patterns in violated fields
   - Update forbidden field list if needed

2. **Monthly Scorecard API Health:**
   - Verify all three scorecard endpoints are responsive
   - Check validation pass rates
   - Review false positives/negatives

3. **Quarterly Field Whitelist Review:**
   - Validate approved fields still match scorecard API schema
   - Add new fields as scorecard system evolves
   - Remove deprecated fields

### **Alert Thresholds**

- **Critical:** >10% validation failure rate
- **High:** New forbidden fields detected in responses
- **Medium:** Unusual violation patterns by user/query type
- **Low:** Minor field extraction issues

## 🚀 Future Enhancements

### **Planned Features**
- Real-time scorecard API schema validation
- Machine learning-based field pattern detection
- Automated prompt template optimization based on violation patterns
- Integration with business intelligence dashboards

### **Extension Points**
- Additional data source validators (vendor, service catalog)
- Custom validation rules per user role
- API rate limiting for scorecard endpoint calls
- Response caching for frequently requested data

---

## Support & Troubleshooting

For issues with the AI agent validation system:

1. Check console logs for validation messages
2. Review recent violations via `/api/ai-validation/violations`
3. Test specific queries with `/api/ai-validation/test`
4. Verify scorecard API endpoints are accessible
5. Ensure database migration `07-scorecard-validation-logging.sql` is applied

**Emergency Bypass:** Set `ENABLE_SCORECARD_VALIDATION=false` to temporarily disable validation (not recommended for production).