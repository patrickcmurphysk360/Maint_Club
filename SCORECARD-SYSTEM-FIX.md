# Scorecard System Fix Documentation
**Date**: July 31, 2025
**Issue**: Employee scorecards showing all zeros and incorrect field labels

## Issues Identified and Fixed

### 1. Frontend Role Filtering Issue
**Problem**: Frontend was filtering to show only users with role='advisor', excluding store managers and market managers who also have performance data.

**Solution**: 
- Created new API endpoint `/api/users/with-performance-data` that returns ALL users with performance data regardless of role
- Updated frontend to use this new endpoint instead of filtering by role

### 2. Service Data Mapping Mismatch
**Problem**: Frontend expected service data in camelCase properties (e.g., `advisor.coolantFlush`) but API returned services as object with display names (e.g., `{"Coolant Flush": 2}`)

**Solution**:
- Created `mapServicesToScorecard()` function to map API service names to template field keys
- Added support for both generic and branded service names
- Mapped all services to lowercase template field keys (e.g., `coolantflush`, `tirebalance`)

### 3. Template Field Labels Not Displaying
**Problem**: Scorecards showing field keys like "coolantflush" instead of proper labels like "Coolant Flush"

**Solution**:
- Fixed scorecard component to use `field.field_label` from template as primary display name
- Added proper fallback logic for missing labels
- Implemented field key to readable name conversion as last resort

### 4. Vendor Mapping Not Working
**Problem**: Vendor-mapped branded names (e.g., "BG Advanced Formula MOA®") not showing even when configured

**Root Causes**:
1. API only returned services with values > 0, so zero-value services didn't get vendor mappings applied
2. Case mismatch between template field keys (lowercase) and vendor mapping service fields (camelCase)
3. Frontend always used template labels instead of checking for branded names

**Solutions**:
1. Modified API to include ALL services from template, even with zero values
2. Added case-insensitive matching for vendor mapping lookups
3. Updated frontend to check for branded service names first, then fall back to template labels
4. Added `rawApiServices` property to pass branded names from API to scorecard component

## Technical Implementation Details

### API Changes (scorecard.js)
```javascript
// Include all services, even zeros
mappedServices[displayName] = value; // Removed if (value > 0) condition

// Case-insensitive vendor mapping
const matchingKey = Object.keys(vendorMappings).find(key => 
  key.toLowerCase() === templateKey.toLowerCase()
);
```

### Frontend Changes

#### AdvisorScorecards.tsx
```javascript
// Map API services to template field keys
const serviceMapping = {
  coolantflush: apiServices['Coolant Flush'] || 0,
  tirebalance: apiServices['Tire Balance'] || 0,
  // ... etc
};

// Pass raw API services for branded names
rawApiServices: scorecardData.services || {}
```

#### AdvisorScorecard.tsx
```javascript
// Check for branded names first
if (advisor.rawApiServices) {
  const brandedService = Object.keys(advisor.rawApiServices).find(serviceName => {
    if (field.field_key === 'premiumoilchange' && serviceName.includes('MOA®')) return true;
    if (field.field_key === 'engineperformanceservice' && serviceName.includes('EPR®')) return true;
    return false;
  });
  if (brandedService) displayName = brandedService;
}
```

## Results
- ✅ All employees with performance data now visible (not just advisors)
- ✅ Actual performance metrics display correctly (invoices, sales, GP, etc.)
- ✅ Service counts show actual values from uploaded data
- ✅ Field labels display properly ("Coolant Flush" not "coolantflush")
- ✅ Vendor-mapped branded names display correctly:
  - "BG Advanced Formula MOA®" for Premium Oil Change
  - "BG EPR® Engine Performance Restoration®" for Engine Performance Service

## Testing Performed
- Verified API returns complete data with vendor mappings
- Confirmed frontend displays all 24 users with performance data
- Validated service names show both generic and branded versions
- Tested zero-value services display with proper labels

## Future Considerations
- Consider standardizing field key formats across the system
- Add configuration for additional vendor product mappings
- Implement caching for scorecard template data