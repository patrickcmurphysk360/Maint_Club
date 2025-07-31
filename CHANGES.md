# Recent Changes - Maintenance Club MVP

## 🔧 Scorecard System Fixes (2025-07-31)

### Major Issues Fixed
- **Upload System Database Column Mismatch:**
  - Fixed `advisor_mappings` table using wrong column name
  - Changed from `advisor_name` to `spreadsheet_name`
  - Resolved "Failed to process services file" errors
  - Successfully processed stuck upload sessions

- **Scorecard Data Display Issues:**
  - Fixed scorecards showing all zeros for performance data
  - Resolved frontend filtering that excluded non-advisor roles
  - Created new API endpoint to fetch all users with performance data
  - Fixed service data mapping between API and frontend

- **Field Label Display Issues:**
  - Fixed field keys showing instead of labels (e.g., "coolantflush" → "Coolant Flush")
  - Updated template display logic to use proper field labels
  - Added intelligent fallback for missing labels

- **Vendor Mapping System:**
  - Fixed vendor-mapped service names not displaying
  - Resolved case sensitivity issues between template keys and vendor mappings
  - Modified API to include zero-value services with vendor mappings
  - Implemented branded service name display (e.g., "BG Advanced Formula MOA®")

### Technical Improvements
- Added comprehensive debug logging to API
- Enhanced frontend service mapping with template field key support
- Improved error handling and validation
- Updated TypeScript interfaces for better type safety

## 🎯 Advisor Management & Goals System (2025-01-30)

### New Features Implemented
- **Edit User Profile from Scorecard:** Admins can now edit advisor profiles directly from scorecards
  - Full user management (name, email, status, role)
  - Store and market assignment management
  - Permission-based visibility

- **Advisor-to-User Mapping:** Complete mapping system for advisors
  - Search and map existing users
  - Create new users from advisor names
  - Visual indicators for mapping status
  - Remap functionality for changing assignments

- **Enhanced Goal Setting:**
  - Complete service list organized by category
  - All 40+ services available for goal tracking
  - Current values displayed in dropdown
  - Organized by: Core KPIs, Oil & Fluid Services, Brake & Suspension, Engine & Performance, Climate & Electrical, Maintenance & Inspection

- **Goal Display & Variance Tracking:**
  - Visual indicators on scorecards (✓/✗)
  - Variance calculations with percentages
  - Color-coded performance (green/red)
  - Goal indicators on both KPIs and services

### Bug Fixes
- Fixed advisor mapping modal error with undefined names
- Added support for both firstName/lastName and first_name/last_name formats
- Enhanced permission checking for goal setting (403 error debugging)
- Fixed route registration for advisor-mappings endpoint

### API Enhancements
- **POST/PUT/GET /api/users:** Full CRUD operations for user management
- **GET/POST/DELETE /api/advisor-mappings:** Advisor mapping management
- **Enhanced /api/goals:** Better permission handling and error reporting

## 🔧 Service Mapping & Vendor Integration Fixes (2025-01-30)

### Issues Resolved
- **Market Management:** Fixed stores/users not displaying in market edit modal
  - Resolved database column name mismatches (`firstName`/`lastName` vs `first_name`/`last_name`)
  - Fixed type casting issues between `user_store_assignments` and `users` tables
  - Removed corrupted data entries with non-numeric user IDs

- **Service Management:** Fixed "failed to load services" error
  - Corrected route ordering issue where `/:id` route was intercepting `/available-for-calculation`
  - Moved specific routes before parameterized routes in Express router

- **Vendor Tags Cleanup:** Removed dummy vendor data
  - Kept only real vendor tag: "bg_products"
  - Cleaned up test/development entries

### 🆕 New Features
- **GitHub Integration:** Added project to GitHub repository
  - Created comprehensive `.gitignore` for Node.js/Docker projects
  - Initialized git repository and pushed to GitHub

### 🐛 Bug Fixes
- **Store Management:** Auto-display store managers from user assignments
  - Modified stores API to join with `user_store_assignments`
  - Added `STRING_AGG` to concatenate multiple store managers

### 🔄 API Improvements
- **Vendor Mappings API Restructure:**
  - Fixed unreachable code issue in `/api/vendor-mappings` endpoint
  - Now properly returns `{ mappings: [...] }` format for scorecard compatibility
  - Supports filtering by `vendor_id` and `market_id` parameters

### 🎯 Advisor Scorecard Enhancement (In Progress)
- **Service Mapping Integration:** Working on dynamic branded service names
  - Added debugging capability to track service mapping data flow
  - Frontend prepared to display vendor-branded names (e.g., "BG Advanced Formula MOA®" instead of "Premium Oil Change")
  - Debug console logging added for troubleshooting

### 📊 Database Changes
- **Cleaned Data Integrity:**
  - Removed corrupted user assignment records with string IDs
  - Verified vendor product mappings table structure
  - Current mappings: `premiumOilChange` → "BG Advanced Formula MOA®"

### 🔍 Debug Tools Added
- **Frontend Debugging:** Added console logging to trace service mapping data flow
- **API Response Tracking:** Debug output for vendor-mappings endpoint responses
- **Service Display Name Tracking:** Logging to verify branded name substitution

### Next Steps
- Complete advisor scorecard branded service name display
- Remove debug logging once functionality is verified
- Test full end-to-end service mapping workflow

---

## Technical Details

### Files Modified
- `api/routes/markets.js` - Fixed column names and type casting
- `api/routes/stores.js` - Added automatic store manager display
- `api/routes/services-management.js` - Fixed route ordering
- `api/routes/vendor-mappings.js` - Restructured API response format
- `frontend/src/components/Scorecard/AdvisorScorecards.tsx` - Added debug logging
- `frontend/src/constants/serviceCategories.ts` - Enhanced service display name function
- `.gitignore` - Created comprehensive exclusion rules

### Database Cleanup
```sql
-- Removed corrupted user assignment data
DELETE FROM user_store_assignments WHERE user_id ~ '^advisor_';

-- Verified vendor product mappings
SELECT * FROM vendor_product_mappings;
-- Result: 2 active mappings for bg_products vendor
```

### API Endpoint Updates
- `GET /api/vendor-mappings` - Returns proper format for frontend consumption
- Route filtering: `?vendor_id=bg_products&market_id=694`
- Response format: `{ mappings: [{ service_field: 'premiumOilChange', product_name: 'BG Advanced Formula MOA®' }] }`