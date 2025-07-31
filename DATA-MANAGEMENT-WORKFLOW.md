# Data Management System - Complete Workflow Documentation

## Overview
The Data Management System is designed to handle Month-to-Date (MTD) advisor performance data uploads from Excel spreadsheets, with intelligent entity matching and automated data processing.

## System Architecture

### Key Components:
1. **UnifiedUploader** - Frontend upload interface
2. **Enhanced Upload API** - Backend processing with 2-phase workflow
3. **Upload Processor** - Intelligent entity matching engine
4. **Data Management Dashboard** - Central control panel with 7 tabs

## Complete Upload Workflow

### Phase 1: Discovery & Analysis
1. **File Selection**
   - User selects Excel file with MTD services data
   - Filename format: `{marketId}-YYYY-MM-DD-{time}-Services-{hash}.xlsx`
   - Example: `694-2025-07-28-6am-Services-hvENFEtD-1753697245.xlsx`

2. **File Validation**
   - Frontend validates filename format
   - Extracts metadata (market ID, date, type)
   - Displays file analysis to user

3. **Upload & Parse**
   - File uploaded to `/api/enhanced-upload/upload/services/discover`
   - Backend parses Excel sheets:
     - "Service Writers" sheet → Employee/Advisor data
     - "Stores" sheet → Store-level rollups
     - "Markets" sheet → Market-level rollups

4. **Entity Discovery**
   - System extracts unique entities:
     - Markets (from employee data)
     - Stores (with market associations)
     - Advisors (employee names with performance data)

5. **Intelligent Matching**
   - System queries existing database entities
   - Applies fuzzy matching algorithms (Levenshtein distance)
   - Checks `advisor_mappings` table for previously mapped advisors
   - Suggests actions for each entity:
     - `map` - Match to existing entity (high confidence)
     - `create` - Create new entity
     - `ignore` - Skip this entity

### Phase 2: Confirmation & Processing
1. **Confirmation UI**
   - User reviews discovered entities
   - System shows:
     - Auto-matched entities (from previous uploads)
     - Suggested matches with confidence scores
     - Options to create new or map to existing

2. **User Actions**
   - Can accept auto-matches
   - Override system suggestions
   - Provide details for new entities (emails, IDs, etc.)

3. **Processing**
   - Confirmed data sent to `/api/enhanced-upload/upload/confirm/{sessionId}`
   - System creates/updates:
     - Markets table
     - Stores table
     - Users table (for advisors)
     - Advisor_mappings table (for future auto-matching)
     - Performance_data table (with proper linkages)
     - User-store/market assignments

4. **Data Storage**
   - Performance records stored with:
     - `market_id` - Links to markets table
     - `store_id` - Links to stores table
     - `advisor_user_id` - Links to users table
     - `data` - JSONB field with complete row data

## Data Management Dashboard Features

### 1. Upload Services Tab
- Drag-and-drop file upload
- Real-time file validation
- Auto-detection of file metadata
- Upload progress tracking

### 2. Upload History Tab
- Complete upload audit trail
- Filter by status, date, file type
- View processing details
- Re-process failed uploads

### 3. Advisor Mappings Tab
- View all advisor name → user ID mappings
- Edit existing mappings
- Deactivate incorrect mappings
- Bulk mapping operations

### 4. Data Verification Tab
- Real-time data integrity monitoring
- Shows linkage percentages:
  - Market linkage (should be 100%)
  - Store linkage (should be 100%)
  - Advisor linkage (should be 100%)
- Identifies orphaned records
- Sample data preview

### 5. Monitoring Tab
- Upload statistics and trends
- Success/failure rates
- Processing time metrics
- Error categorization
- Auto-refresh capabilities

### 6. Troubleshoot Tab
- System health checks
- Common issue detection
- Auto-fix capabilities
- Detailed error logs
- Recommendations engine

### 7. Database Schema Tab
- Complete table documentation
- Field descriptions and types
- Relationship visualization
- Sample data viewing
- Export schema documentation

## Smart Features

### Advisor Recognition System
- **First Upload**: System prompts for advisor → user mapping
- **Subsequent Uploads**: Auto-recognizes advisors, no re-confirmation needed
- **Fuzzy Matching**: Handles name variations (John Smith vs J. Smith)
- **Persistence**: Mappings stored in `advisor_mappings` table

### Market/Store Intelligence
- Auto-matches based on exact name match
- Fuzzy matching for variations
- Preserves spreadsheet market IDs
- Maintains hierarchical relationships

### Data Integrity
- Complete audit trail in `upload_sessions` table
- Raw data preserved in JSONB format
- Foreign key constraints ensure referential integrity
- Orphan detection and cleanup tools

## Production Readiness

### Current Issues to Fix:
1. **Mock Data in UI** - Components default to mock data when API fails
2. **API Connection** - Frontend needs proper error handling
3. **Upload Processing** - Need to debug the actual upload failure

### Data Flow for Production:
```
Excel File → Upload → Parse → Discover Entities → Match/Create → Store Performance Data
                                    ↓
                            Advisor Mappings Table
                                    ↓
                            Future Auto-Recognition
```

## Troubleshooting Upload Failures

### Common Issues:
1. **API Connection Failed**
   - Check frontend .env file has `REACT_APP_API_URL=http://localhost:5000`
   - Ensure API server is running on port 5000
   - Verify database connection in api/.env

2. **File Format Invalid**
   - Filename must match: `{marketId}-YYYY-MM-DD-{time}-Services-{hash}.xlsx`
   - File must be Excel format (.xlsx)
   - Required sheets: "Service Writers", "Stores", "Markets"

3. **Authentication Failed**
   - User must be logged in with admin/administrator role
   - JWT token must be valid
   - Check user permissions in database

4. **Processing Failed**
   - Check for existing entities with conflicting IDs
   - Verify all required fields in spreadsheet
   - Check database constraints

## Next Steps for Production MVP

1. **Remove Mock Data**
   - Update all components to show proper error states
   - Implement retry mechanisms
   - Add user-friendly error messages

2. **Enhance Upload Feedback**
   - Show detailed progress during processing
   - Clear error messages with solutions
   - Success confirmations with summary

3. **Data Validation**
   - Validate spreadsheet structure before processing
   - Check for required columns
   - Validate data types and formats

4. **Performance Optimization**
   - Batch processing for large files
   - Progress indicators for long operations
   - Background processing capabilities