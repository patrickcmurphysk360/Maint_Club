# Store Separation Bug Fix

## 🐛 **Issue Identified**

**Problem**: Akeem Jackson's Atlanta store tab was showing aggregated data from all 3 stores instead of Atlanta-specific data.

**Current (Wrong) Atlanta Numbers**:
- Invoices: 378 (should be 216)
- Sales: $107,846 (should be $64,779)
- GP Sales: $45,348 (should be $27,656)
- GP Percent: 42.0% (should be 42.7%)

**Expected Atlanta Only Numbers**:
- Invoices: 216
- Sales: $64,779
- GP Sales: $27,656  
- GP Percent: 42.7%
- All Tires: 191

## 🔧 **Root Cause**

The store separation logic in the by-store API was using `row.store_id || 'unknown'` which could group multiple stores under 'unknown' if the store_id was null/undefined.

## ✅ **Fixes Applied**

### 1. **Improved Store Key Logic** (`api/routes/scorecard.js:497`)
```javascript
// OLD: Could group stores incorrectly
const storeKey = row.store_id || 'unknown';

// NEW: Better store identification  
const storeKey = row.store_id_numeric || row.store_id || 'unknown';
```

### 2. **Added Debug Logging**
- Store record processing
- Data aggregation per store  
- Final store totals
- All Tires service detection

### 3. **Enhanced Service Debugging**
- Tracks `allTires` field aggregation
- Tracks `'All Tires'` in otherServices  
- Shows which store gets which service values

## 🎯 **What Should Happen Now**

When you refresh Akeem's scorecard, you should see:

### **Console Logs** (in browser DevTools or server logs):
```
📊 Processing record: Store ID: [atlanta_id], Numeric ID: [num], Name: Atlanta, Key: [key]
🏪 Created new store group: [atlanta_key] (Atlanta)
📊 Adding to Atlanta: Invoices: 216, Sales: 64779, GP Sales: 27656
🔧 Found allTires for Atlanta: 191 (total now: 191)
🏪 Final totals for Atlanta (Key: [atlanta_key]):
   Invoices: 216
   Sales: $64779
   GP Sales: $27656
   GP %: 42.7%
   Records: 1
```

### **Frontend Display**:
- **Atlanta Tab**: Should show ONLY Atlanta's 216 invoices, $64,779 sales
- **McDonough Tab**: Should show McDonough-specific numbers
- **Marietta Blvd Tab**: Should show Marietta-specific numbers
- **Rollup Tab**: Should show combined totals (378 invoices, $107,846 sales)

### **All Tires Service**:
- Should appear in Services section of each store tab
- Atlanta should show 191 All Tires
- Rollup should show combined All Tires from all stores

## 🔍 **Testing Steps**

1. **Open Browser DevTools** → Console tab
2. **Navigate to Akeem's scorecard** 
3. **Look for debug logs** showing store separation
4. **Check Atlanta tab numbers** - should match expected values
5. **Verify All Tires appears** in services section

## 🐛 **If Issue Persists**

If you still see aggregated numbers in individual store tabs, the issue could be:

1. **Database Store IDs**: Store records might have NULL store_ids
2. **Data Structure**: Performance data might not have proper store separation
3. **Multiple Records**: Multiple performance records per store being double-counted

The debug logs will show exactly what's happening in the aggregation process.

## 📊 **Expected Final Result**

**Rollup Tab** (All Stores Combined):
- Invoices: 378 (216 + McDonough + Marietta)
- Sales: $107,846 ($64,779 + McDonough + Marietta)
- All Tires: [Combined total]

**Atlanta Tab** (Atlanta Only):
- Invoices: 216 ✅
- Sales: $64,779 ✅  
- GP Sales: $27,656 ✅
- GP Percent: 42.7% ✅
- All Tires: 191 ✅

The store-specific tabs should now show accurate per-location data instead of aggregated totals.