# Service Field Mapping System

## Overview
The Service Field Mapping System provides dynamic, user-configurable mapping between spreadsheet headers and scorecard fields, replacing hardcoded field mappings with a flexible, transparent interface.

## Implementation Date
**August 3, 2025** - Full system implementation and deployment

## Key Benefits
- **🔍 Transparency**: View exactly how spreadsheet columns map to scorecard fields
- **🔧 Flexibility**: Modify mappings without code changes
- **🎯 Market Customization**: Create market-specific mapping overrides
- **📊 Preview Mode**: See mapping results before processing uploads
- **✅ Validation**: Detect conflicts and validate field types

## System Architecture

### Database Schema
```sql
-- Global default mappings (54 pre-populated from existing logic)
default_field_mappings
- spreadsheet_header: Source column name (e.g., "Oil Change")
- scorecard_field_key: Target field (e.g., "oilchange") 
- field_type: direct|nested|calculated|percentage
- data_field_name: Actual data property name
- display_label: Human-readable label
- is_percentage: Boolean flag for percentage fields
- sort_order: Display ordering

-- Market-specific overrides
service_field_mappings
- market_id: FK to markets table
- [same fields as defaults with higher priority]

-- Discovered headers tracking
discovered_spreadsheet_headers
- market_id, spreadsheet_filename, header_name
- sheet_name, column_position, sample_values
- is_mapped: Boolean tracking status
```

### API Endpoints (`/api/field-mappings`)
```typescript
GET /:marketId?               // Get effective mappings (defaults + overrides)
POST /:marketId               // Create/update market-specific mappings
PUT /default/:mappingId       // Update global default mapping
POST /discover-headers        // Auto-detect spreadsheet headers
POST /preview                 // Preview mapping results
GET /:marketId/discovered-headers // Get discovered headers history
```

### Frontend Components
- **ServiceFieldMappingManager**: Main UI component with 3-tab interface
- **Field Mappings Tab**: View/edit current mappings with inline editing
- **Discover Headers Tab**: Upload spreadsheet to auto-detect columns
- **Preview Results Tab**: See how data would be transformed

## Field Mapping Types

### 🔄 Direct Fields
Maps directly to top-level properties in parsed data.
```
Example: "Sales" → data.sales
Usage: Standard financial metrics, store info, basic KPIs
```

### 🗂️ Nested Fields  
Maps to properties inside the `otherServices` JSON object.
```
Example: "Custom Service A" → data.otherServices.customServiceA
Usage: Market-specific services, custom KPIs, vendor offerings
```

### 🧮 Calculated Fields
Fields requiring mathematical operations or complex logic.
```
Example: "Revenue per Invoice" = Sales ÷ Invoices
Usage: Derived metrics, ratios, performance indicators
```

### 📈 Percentage Fields
Fields containing percentage values with special formatting.
```
Example: "GP %" → formatted as percentage
Usage: Any metric displayed as percentage
```

## User Workflow

### 1. Managing Field Mappings
1. Navigate to **Data Management Dashboard** → **Field Mappings** tab
2. View current mappings in table format with field types and labels
3. Click **Edit** on any row to modify mapping details
4. Update field type, scorecard field, or display label
5. Click **Save Mapping** to persist changes

### 2. Discovering New Headers
1. Go to **Discover Headers** tab
2. Click **Upload Spreadsheet** and select file
3. System auto-detects all column headers across sheets
4. View sample values for each discovered header
5. See which headers are already mapped vs unmapped

### 3. Previewing Mappings
1. Upload a spreadsheet in **Discover Headers**
2. Go to **Preview Results** tab
3. See exactly how first 5 rows would be transformed
4. Identify mapping conflicts or missing fields
5. Validate data transformation before processing

## Enhanced ExcelParser Integration

### Dynamic Mapping Resolution
```javascript
// Enhanced ExcelParser constructor
constructor(fieldMappings = null, pool = null) {
  this.fieldMappings = fieldMappings;
  this.pool = pool;
  // Fallback to original hardcoded columns
}

// Load mappings with market-specific overrides
async loadFieldMappings(marketId = null) {
  // Query: defaults + market overrides with priority resolution
}

// Enhanced getCellValue with dynamic lookup
getCellValue(row, headers, columnName) {
  // 1. Check field mappings for header translation
  // 2. Apply percentage conversion if needed
  // 3. Fallback to original logic
}
```

### Data Transformation Pipeline
```javascript
// Apply field mappings after parsing
applyFieldMappings(parsedData) {
  // Transform direct mappings: source → target keys
  // Group nested mappings into otherServices object
  // Apply calculated field logic
  // Handle percentage formatting
}
```

## Default Mappings (54 Fields)

### Core Identifiers
- ID → storeid (Store identifier)
- Market → market (Market name)
- Store → storename (Store name)
- Employee → employeename (Employee name)

### Financial Metrics
- Sales → sales (Total sales amount)
- GP Sales → gpsales (Gross profit sales)
- GP Percent → gppercent (Gross profit percentage)
- Avg. Spend → avgspend (Average customer spend)
- Invoices → invoices (Invoice count)

### Service Categories (Direct)
- Oil Change → oilchange
- Premium Oil Change → premiumoilchange
- Brake Service → brakeservice
- Brake Flush → brakeflush
- Alignments → alignments
- Coolant Flush → coolantflush
- Differential Service → differentialservice
- Power Steering Flush → powersteeringflush
- Transmission Fluid Service → transmissionfluidservice
- Battery → battery

### Service Categories (Nested)
- Engine Flush → otherServices.engineflush
- Fuel Additive → otherServices.fueladditive
- Filters → otherServices.filters
- Spark Plug Replacement → otherServices.sparkplugreplacement
- AC Service → otherServices.acservice
- Shocks & Struts → otherServices.shocksstruts
- Wiper Blades → otherServices.wiperblades

### Tire Metrics
- All Tires → alltires
- Retail Tires → retailtires
- Tire Protection → tireprotection
- Tire Protection % → tireprotectionpercent (percentage)

### Performance Indicators
- Potential Alignments → potentialalignments
- Potential Alignments Sold → potentialalignmentssold
- Potential Alignments % → potentialalignmentspercent (percentage)
- Brake Flush to Service % → brakeflushtoservicepercent (percentage)

## Technical Implementation Details

### Database Functions
```sql
-- Get effective mappings with priority resolution
CREATE OR REPLACE FUNCTION get_effective_field_mappings(p_market_id INTEGER)
RETURNS TABLE(...) AS $$
  -- Returns: defaults + market overrides with priority ordering
$$;
```

### API Response Format
```json
{
  "marketId": 1,
  "mappings": [
    {
      "id": 1,
      "spreadsheet_header": "Oil Change",
      "scorecard_field_key": "oilchange",
      "field_type": "direct",
      "data_field_name": "oilchange",
      "display_label": "Oil Change",
      "is_percentage": false,
      "sort_order": 10,
      "is_override": false
    }
  ],
  "total": 54
}
```

### Frontend State Management
```typescript
interface FieldMapping {
  id?: number;
  spreadsheet_header: string;
  scorecard_field_key: string;
  field_type: 'direct' | 'nested' | 'calculated' | 'percentage';
  data_field_name: string;
  display_label: string;
  is_percentage: boolean;
  is_active: boolean;
}
```

## Configuration Options

### Market-Specific Customization
- Override default mappings for specific markets
- Create custom field mappings for regional requirements
- Maintain consistency while allowing flexibility

### Field Type Management
- **Direct**: Standard scorecard fields
- **Nested**: Custom services in otherServices object
- **Calculated**: Fields requiring computation
- **Percentage**: Special formatting for percentage values

### Validation Rules
- Prevent duplicate scorecard field assignments
- Validate required field completeness
- Check for mapping conflicts across field types
- Ensure data field name consistency

## Troubleshooting

### Common Issues

**Edit Button Not Working**
- Fixed: Form now uses `editingMapping` state correctly
- Ensure proper React state management in controlled components

**Mappings Not Saving**
- Check API endpoint routing (default vs market-specific)
- Verify required fields are populated
- Check network tab for error responses

**Headers Not Discovered**
- Ensure file upload completes successfully
- Check supported file formats (.xlsx, .xls, .csv)
- Verify sheet names and data structure

### API Debugging
```bash
# Test field mappings endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/field-mappings/default

# Test discover headers
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@sample.xlsx" \
  http://localhost:5000/api/field-mappings/discover-headers
```

## Future Enhancements

### Planned Features
- **Bulk Import/Export**: Save and load mapping configurations
- **Mapping Templates**: Pre-defined mapping sets for different file types
- **Advanced Calculations**: Formula builder for calculated fields
- **Field Validation**: Data type checking and range validation
- **Audit Trail**: Track mapping changes over time

### Integration Opportunities
- **Scorecard Templates**: Auto-sync with service catalog changes
- **Vendor Mappings**: Link with vendor branding system
- **Data Validation**: Pre-upload file structure checking
- **Performance Monitoring**: Track mapping effectiveness

## Security Considerations
- Authentication required for all mapping operations
- Market-specific access controls
- Audit logging for configuration changes
- Input validation and sanitization

## Performance Notes
- Database indexes on frequently queried columns
- Cached field mappings for repeated operations
- Optimized query plans for effective mapping resolution
- Minimal API calls through batched operations

---

**System Status**: ✅ **Production Ready**  
**Last Updated**: August 3, 2025  
**Version**: 1.0.0  
**Maintainer**: Claude Code Assistant