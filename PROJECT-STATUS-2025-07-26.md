# Maintenance Club MVP - Project Status & Development Guide
**Date: July 29, 2025**

## Project Overview
Maintenance Club MVP is a performance management portal for automotive service shops that helps track advisor performance, manage vendor relationships, and process operational data from spreadsheet uploads.

## Development Environment

### Project Structure
```
C:\Users\patri\projects\          <- Root projects directory
├── docker-compose.yml            <- Main Docker Compose file (run from here)
├── maint_club\                   <- Maintenance Club project directory
│   ├── api\                      <- Node.js Express API
│   ├── frontend\                 <- React TypeScript frontend
│   ├── database-scripts\         <- SQL migration scripts
│   └── PROJECT-STATUS-2025-07-26.md
└── [other-projects]\
```

### Docker Container Setup
**IMPORTANT**: Run all `docker-compose` commands from `C:\Users\patri\projects\` directory, not from within `maint_club\`.

The project uses Docker Compose with multiple containers defined in `C:\Users\patri\projects\docker-compose.yml`:

#### Key Containers:
1. **maintenance-club-frontend** (Port 3007)
   - React TypeScript application
   - Hot-reloading enabled
   - Volume: `./maint_club/frontend:/app`

2. **maintenance-club-api** (Port 5002)
   - Node.js Express API
   - JWT authentication
   - Volume: `./maint_club/api:/app`

3. **postgres** (Port 5432)
   - PostgreSQL database
   - Database: `maintenance_club_mvp`
   - Credentials: admin/ducks2020

### Starting the Environment
```bash
docker-compose up -d
```

### Accessing the Application
- Frontend: http://localhost:3007
- API: http://localhost:5002
- Admin Login: admin@example.com / admin123

## Current Features Implemented

### 1. User Management (Phase 1)
- User CRUD operations with role-based access
- Support for both string IDs (Phase 1) and integer IDs (MVP)
- Roles: administrator, advisor, market_manager, store_manager

### 2. Vendor Management System
- **Vendor Partners**: Company profiles with contact information
- **Product Catalog**: Vendor-specific products with SKUs
- **Service Mappings**: Map generic services to branded products
  - Example: "Premium Oil Change" → "BG MOA"

### 3. Advisor Scorecards
- Display performance metrics for advisors
- Integrated with service mappings to show branded product names
- Goal setting functionality for KPIs

### 4. Market & Store Management
- Market profiles with city, state, zip, contact manager
- Store management with market associations
- User-store and user-market assignments

### 5. Spreadsheet Upload System
- Two-step process: Discovery → Confirmation
- Intelligent matching with Levenshtein distance algorithm
- Auto-discovers markets, stores, and advisors from uploads

## Current Issues & Tomorrow's Tasks

### 🔴 CRITICAL: Service Mapping "Create Mapping" Button Issue

**Problem**: The "Create Mapping" button submits but doesn't save the mapping.

**What We Know**:
1. Frontend sends correct data structure (verified with console.log)
2. API endpoints have been updated to use `vendor_product_mappings` table
3. No visible errors in browser console or network tab

**What to Check Tomorrow**:
1. **Database Constraints**:
   ```sql
   -- Check if vendor_tags table has the vendor_id
   SELECT * FROM vendor_tags WHERE id = 'vendor_tag_value';
   
   -- Check foreign key constraints
   \d vendor_product_mappings
   ```

2. **API Response Handling**:
   - Add more detailed error logging in vendor-mappings.js
   - Check if the response is being properly handled in the frontend
   - Verify the success/error messages are displaying

3. **Frontend State Management**:
   - Check if `loadServiceMappings()` is being called after successful creation
   - Verify the mapping appears after manual page refresh

**Debug Steps**:
```javascript
// In VendorManagement.tsx handleMappingSubmit
console.log('Response status:', response.status);
const responseData = await response.json();
console.log('Response data:', responseData);
```

### ✅ COMPLETED TODAY: Production MVP Consolidation
- **Removed all Phase 1 references** from codebase (as requested)
- **Fixed advisor scorecards** to show actual store/market assignments
- **Consolidated user system** to single numeric ID approach
- **Clean MVP-only endpoints** ready for production use

## Key Technical Details

### Database Schema Notes
- **User IDs**: Mix of string (Phase 1) and integer (MVP) IDs
- **Foreign Keys**: Many tables use varchar(50) for IDs to support Phase 1 users
- **Service Mappings**: Stored in `vendor_product_mappings` table

### API Architecture
- JWT authentication required for all endpoints
- Base URL: http://localhost:5002/api
- Key routes:
  - `/auth/login` - Authentication
  - `/phase1/users` - User management
  - `/vendor-partners` - Vendor CRUD
  - `/vendor-mappings` - Service mappings
  - `/service-catalog` - 45 generic services

### Frontend Architecture
- React with TypeScript
- Tailwind CSS for styling
- Context API for authentication
- Key components:
  - `VendorManagement.tsx` - Main vendor interface
  - `AdvisorScorecards.tsx` - Performance dashboards
  - `UploadConfirmation.tsx` - Spreadsheet processing

## Recent Changes Made Today

1. **Combined Vendor Interfaces**: Merged vendor partners and mappings into single "Vendor Management" tab
2. **Fixed TypeScript Errors**: Resolved null/undefined type mismatches in vendor product selection
3. **Updated Service Mappings**: Changed from text input to dropdown selection from vendor products
4. **Fixed API Syntax Error**: Resolved duplicate variable declarations in vendor-mappings.js
5. **Enhanced Advisor Scorecards**: Added branded service name display using vendor mappings

## Development Tips

### Common Commands
```bash
# View logs
docker logs maintenance-club-frontend --tail 50
docker logs maintenance-club-api --tail 50

# Restart containers
docker restart maintenance-club-frontend
docker restart maintenance-club-api

# Database queries
docker exec postgres psql -U admin -d maintenance_club_mvp
```

### Testing Service Mappings
1. Ensure vendor has products in their catalog
2. Service field names must match camelCase format (e.g., "premiumOilChange")
3. Check browser console for request/response details

## Next Steps

1. **Fix Service Mapping Creation** - Debug why mappings aren't saving
2. **Add Market-Specific Mappings** - Currently global per vendor  
3. **Enhance Upload Processing** - Better error handling and validation
4. **Add Reporting Features** - Export functionality for scorecards
5. **Production Readiness** - Environment configuration, security headers, monitoring

## Environment Variables
Located in Docker container configurations:
- JWT_SECRET: maintenance_club_jwt_secret_change_in_production
- REACT_APP_API_URL: http://localhost:5002

## Important File Locations
- Frontend: `C:\Users\patri\projects\maint_club\frontend\`
- API: `C:\Users\patri\projects\maint_club\api\`
- Database Scripts: `C:\Users\patri\projects\database-scripts\`
- Docker Compose: `C:\Users\patri\projects\docker-compose.yml`

## Recent Updates (July 29, 2025)

### ✅ Removed All Phase 1 References 
- **Archived Phase1 components**: Moved to `frontend/src/archived/phase1/` and `api/archived/phase1-routes/`
- **Created new MVP components**: 
  - `UserManagement.tsx` - Uses MVP `/api/users` endpoint with proper store/market assignments
  - `MarketManagement.tsx` and `StoreManagement.tsx` - Placeholder components
- **Updated Dashboard**: Removed Phase1 imports and user type checks
- **Updated API**: Removed all Phase1 route registrations from server.js
- **Result**: Clean MVP-only codebase ready for production

## Recent Updates (July 29, 2025)

### ✅ Fixed Missing Advisor Data and Markets in Scorecards
- **Issue**: Admin login showed no advisor data and markets dropdown was empty
- **Root Cause**: `advisor_mappings` table was empty - no links between users and performance data
- **Solution**: 
  - Created 24 advisor mappings linking performance data (advisor_user_id 243-266) to users
  - All advisors mapped to market_id 694 ("Tire South - Tekmetric") and store_id 57 ("Mcdonough")
  - Updated `/api/users` endpoint to include `store_assignments` and `market_assignments` data

### ✅ Completed Advisor Scorecard Store/Market Display
- **Issue**: Advisor scorecards showing "Pending Assignment" instead of actual store/market assignments
- **Root Cause**: Frontend not properly extracting store/market data from user assignments
- **Solution**:
  - Updated `CombinedUser` interface to include `store_assignments` and `market_assignments` arrays
  - Modified scorecard display logic to show comma-separated lists of assigned stores/markets
  - Added proper fallback handling (only shows "Pending Assignment" if no assignments exist)
  - Completely removed all Phase 1 API references from advisor scorecards
  - Updated API documentation to remove Phase 1 endpoints

### Database Credentials (Updated)
- **Database**: `maintenance_club_mvp`
- **User**: `admin` 
- **Password**: `ducks2020`
- **Host**: `postgres` (container name)

### Container Cleanup
- Removed old `maintclub-api` container that was causing restart loops
- Main API container: `maintenance-club-api` (healthy)

---

**Note**: All Docker commands should be run from `C:\Users\patri\projects\` directory, not from within `maint_club\`.