# Akeem Jackson Data Diagnostic Report

## 📊 Expected Data (Atlanta Store - July 31, 2025 Upload)

- **Invoices**: 216
- **Sales**: $64,779
- **Avg Spend**: $300
- **GP Sales**: $27,656
- **GP Percent**: 42.7%
- **All Tires**: 191

## 🔍 Data Flow Analysis

### 1. Excel Parsing (`api/services/excelParser.js`)
```javascript
// Line 145: Excel column "All Tires" → allTires field
allTires: this.parseInt(this.getCellValue(row, headers, 'All Tires'))
```

### 2. Data Storage (`performance_data` table)
```sql
-- Employee data stored as JSON
{
  "invoices": 216,
  "sales": 64779,
  "gpSales": 27656,
  "gpPercent": 42.7,
  "allTires": 191,  // Direct field
  // ... other fields
}
```

### 3. Scorecard API Aggregation (`api/routes/scorecard.js`)
```javascript
// Lines 117-121: Aggregation logic
Object.keys(data).forEach(key => {
  if (typeof data[key] === 'number' && key !== 'invoices' && key !== 'sales' && key !== 'gpSales') {
    aggregatedData[key] = (aggregatedData[key] || 0) + data[key];
  }
});
```

### 4. Template Field Mapping (`api/routes/scorecard.js`)
```javascript
// Line 159: Template mapping
'alltires': { type: 'direct', field: 'allTires', label: 'All Tires' }
```

## 🐛 Potential Issues to Check

### Issue 1: Advisor Name Mapping
- Check `advisor_mappings` table for exact name match
- Possible variations: "Akeem Jackson", "A. Jackson", "Jackson, Akeem"

### Issue 2: Store ID Mapping
- Atlanta store must exist in `stores` table
- Store ID type conversion (string vs numeric)

### Issue 3: Date Filtering
- Upload date: 2025-07-31
- MTD query uses: `EXTRACT(MONTH) = 7`
- Should capture all July data

### Issue 4: Multi-Store Aggregation
- Akeem works at 3 stores: McDonough, Atlanta, Marietta Blvd
- Regular scorecard aggregates ALL stores
- By-store API should separate by store

## 📋 SQL Queries to Debug

### 1. Find Akeem's User ID
```sql
SELECT id, spreadsheet_name, user_id, is_active 
FROM advisor_mappings 
WHERE LOWER(spreadsheet_name) LIKE '%akeem%' 
   OR LOWER(spreadsheet_name) LIKE '%jackson%';
```

### 2. Check Raw Performance Data
```sql
SELECT 
  pd.upload_date,
  pd.store_id,
  s.name as store_name,
  pd.data->>'invoices' as invoices,
  pd.data->>'sales' as sales,
  pd.data->>'allTires' as all_tires
FROM performance_data pd
LEFT JOIN stores s ON pd.store_id::text = s.id::text
WHERE pd.advisor_user_id = [AKEEM_USER_ID]
  AND pd.upload_date >= '2025-07-31'
  AND pd.upload_date < '2025-08-01';
```

### 3. Check Atlanta Store Specifically
```sql
SELECT 
  pd.data->>'invoices' as invoices,
  pd.data->>'sales' as sales,
  pd.data->>'gpSales' as gp_sales,
  pd.data->>'gpPercent' as gp_percent,
  pd.data->>'allTires' as all_tires
FROM performance_data pd
JOIN stores s ON pd.store_id::text = s.id::text
WHERE pd.advisor_user_id = [AKEEM_USER_ID]
  AND LOWER(s.name) LIKE '%atlanta%'
  AND pd.upload_date >= '2025-07-31';
```

## 🔧 Frontend Display Issues

### Admin View (AdvisorScorecards.tsx)
- Should show multi-store tabs if Akeem works at 3 stores
- Atlanta tab should show exact numbers

### Personal View (PersonalScorecard.tsx)
- Fixed market ID issue (now uses by-store API response)
- Should load Tire South template with All Tires field

## ✅ Verification Steps

1. **Check Database**:
   - Advisor mapping exists for Akeem
   - Atlanta store exists in stores table
   - Performance data has July 31 records

2. **Check API Response**:
   - `/api/scorecard/advisor/[ID]/by-store?mtdYear=2025&mtdMonth=7`
   - Should return Atlanta data matching expected values

3. **Check Frontend**:
   - Multi-store tabs appear
   - Atlanta tab shows correct numbers
   - All Tires service displays with value 191

## 🎯 Next Steps

Without database access, I recommend:

1. Run the diagnostic SQL queries above
2. Check API response in browser DevTools
3. Verify template includes "alltires" field
4. Confirm multi-store detection works

The issue is likely in one of these areas:
- Advisor name mapping mismatch
- Store ID/name mismatch
- Service field not displaying due to template configuration
- Aggregation including/excluding wrong stores