# MTD Data Fix - Latest Snapshot Only

## 🐛 **Issue Fixed**

**Problem**: System was aggregating multiple MTD snapshots instead of using only the latest one.

**Example**:
- July 25 upload: 200 invoices MTD  
- July 31 upload: 216 invoices MTD
- **Before**: Displayed 416 invoices (200+216) ❌ WRONG
- **After**: Displays 216 invoices (latest only) ✅ CORRECT

## 🔧 **Changes Made**

### 1. **API Query Updates** (`api/routes/scorecard.js`)

**Regular Scorecard API** & **By-Store API**:
```sql
-- OLD: Got all records and summed them
SELECT * FROM performance_data WHERE...

-- NEW: Gets only latest record per store  
WITH latest_per_store AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY store_id 
    ORDER BY upload_date DESC
  ) as rn
  FROM performance_data WHERE...
)
SELECT * FROM latest_per_store WHERE rn = 1
```

### 2. **Aggregation Logic Updates**

**Before**:
```javascript
// Summed multiple records per store
storeData.metrics.invoices += parseInt(data.invoices || 0);
```

**After**:
```javascript
// Uses latest MTD value directly
storeData.metrics.invoices = parseInt(data.invoices || 0);
```

### 3. **Date Display Updates**

**Frontend Changes**:
- Dropdown: "July Performance - July 31, 2025" 
- Scorecard header: "as of July 30, 2025" (data date)
- Shows actual data date, not file upload date

## 🎯 **Expected Results for Akeem's Atlanta Store**

### **Before Fix**:
- Invoices: 378 (multiple MTD snapshots summed)
- Sales: $107,846 (multiple MTD snapshots summed)  
- "2 uploads" notation

### **After Fix**:
- Invoices: 216 (latest MTD snapshot only) ✅
- Sales: $64,779 (latest MTD snapshot only) ✅
- "1 upload" notation (only shows latest)

## 📊 **Store Comparison After Fix**

**Expected Atlanta Numbers**:
```
🏪 Atlanta
1 upload  
216 Invoices
$64,779 Sales  
$27,656 GP Sales
42.7% GP %
Store contribution: [calculated]% of total sales
```

**Combined Total Should Now Be**:
```
📊 Combined Total
3 Stores
[216 + McDonough + Marietta] Invoices
[$64,779 + McDonough + Marietta] Sales
```

## 🔍 **Debug Logging Added**

Console will show:
```
📊 Getting MTD data for 2025-07 for user [ID] (latest per store only)
📊 Latest MTD for Atlanta: Invoices: 216, Sales: 64779, Upload: 2025-07-31
🔧 Latest allTires for Atlanta: 191 (rollup total now: [total])
📊 Using latest MTD snapshot for Atlanta: 216 invoices, $64779 sales
```

## ✅ **What to Test**

1. **Refresh Akeem's scorecard**
2. **Check Atlanta tab** - should show 216 invoices, $64,779 sales
3. **Check "uploads" notation** - should show "1 upload" not "2 uploads"  
4. **Check All Tires service** - should show 191
5. **Check rollup tab** - should show realistic combined totals
6. **Check date displays** - should show "July Performance - July 31, 2025"

## 💡 **Future Enhancement: Daily Performance**

To calculate daily performance (as mentioned):
```javascript
// Daily = Current MTD - Previous MTD
const dailyInvoices = currentMTD.invoices - previousMTD.invoices;
```

This would require:
- Storing historical MTD snapshots
- Calculating day-over-day variance  
- Adding daily performance columns to scorecard

The current fix ensures MTD accuracy first, which is the foundation for any daily calculations.