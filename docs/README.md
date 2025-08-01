# Maintenance Club MVP - Documentation Index

## 📚 Documentation Overview

This folder contains detailed technical documentation for specific fixes, implementations, and diagnostic processes.

## 🗂️ File Organization

### 🔧 Technical Fixes & Implementations
- **[MTD-DATA-FIX.md](MTD-DATA-FIX.md)** - August 1, 2025
  - Critical fix for MTD data aggregation using latest upload only
  - Resolved double-counting of performance data across multiple uploads
  - Implementation details for ROW_NUMBER() OVER PARTITION BY solution

- **[STORE-SEPARATION-FIX.md](STORE-SEPARATION-FIX.md)** - August 1, 2025
  - Fixed multi-store advisor data separation in scorecard tabs
  - Enhanced store key logic and debug logging
  - Expected vs actual results documentation

- **[UPLOAD-SYSTEM-FIX.md](UPLOAD-SYSTEM-FIX.md)** - July 31, 2025
  - Database column mismatch fix (advisor_name → spreadsheet_name)
  - Upload system verification and validation
  - Auto-processing automation fixes

- **[SCORECARD-SYSTEM-FIX.md](SCORECARD-SYSTEM-FIX.md)** - July 31, 2025
  - Complete scorecard data display fix
  - Vendor mapping integration and branded service names
  - Multi-store aggregation implementation

### 🎯 Feature Implementations
- **[STORE-TABS-IMPLEMENTATION.md](STORE-TABS-IMPLEMENTATION.md)**
  - Multi-store advisor scorecard tab system
  - StorePerformanceTabs component implementation
  - Store separation logic and UI design

- **[ADVISOR-SCORECARD-TEMPLATE-FIX.md](ADVISOR-SCORECARD-TEMPLATE-FIX.md)**
  - Scorecard template system integration
  - Dynamic field loading from service catalog
  - Market-specific template handling

- **[MESSAGE-CENTER-IMPLEMENTATION.md](MESSAGE-CENTER-IMPLEMENTATION.md)**
  - Threaded messaging system implementation
  - Database schema and API endpoints
  - Real-time communication features

### ⚠️ Diagnostic & Troubleshooting
- **[AKEEM-DATA-DIAGNOSTIC.md](AKEEM-DATA-DIAGNOSTIC.md)**
  - Specific diagnostic process for test advisor data
  - Expected vs actual performance numbers
  - Database query examples and validation steps

- **[DATA-MANAGEMENT-WORKFLOW.md](DATA-MANAGEMENT-WORKFLOW.md)**
  - Comprehensive data upload and processing workflow
  - Auto-processing logic and entity matching
  - Troubleshooting guide for upload issues

## 🔗 Related Files (Root Directory)

### Core Documentation
- **[PROJECT-STATUS.md](../PROJECT-STATUS.md)** - Overall project status and progress
- **[README.md](../README.md)** - Main project documentation and setup instructions
- **[CLAUDE.md](../CLAUDE.md)** - Claude AI assistant project context and instructions
- **[CHANGES.md](../CHANGES.md)** - Project changelog and version history

### Development Notes
- **[USER-MANAGEMENT-RESTORATION.md](../USER-MANAGEMENT-RESTORATION.md)** - User management system documentation

## 📋 Usage Guidelines

### For Developers
1. **Start with [PROJECT-STATUS.md](../PROJECT-STATUS.md)** for overall project understanding
2. **Refer to specific fix documents** when working on related issues
3. **Use diagnostic documents** for troubleshooting data-related problems
4. **Check implementation documents** before modifying major features

### For System Administrators
1. **Review [DATA-MANAGEMENT-WORKFLOW.md](DATA-MANAGEMENT-WORKFLOW.md)** for upload processes
2. **Use [AKEEM-DATA-DIAGNOSTIC.md](AKEEM-DATA-DIAGNOSTIC.md)** as a template for data validation
3. **Reference fix documents** for understanding system behavior

### For Future Development
1. **MTD processing** - See [MTD-DATA-FIX.md](MTD-DATA-FIX.md) for aggregation patterns
2. **Multi-store features** - See [STORE-SEPARATION-FIX.md](STORE-SEPARATION-FIX.md) and [STORE-TABS-IMPLEMENTATION.md](STORE-TABS-IMPLEMENTATION.md)
3. **Upload automation** - See [UPLOAD-SYSTEM-FIX.md](UPLOAD-SYSTEM-FIX.md) and [DATA-MANAGEMENT-WORKFLOW.md](DATA-MANAGEMENT-WORKFLOW.md)

## 🚀 Current System Status

**MTD Data Processing:** ✅ FULLY OPERATIONAL
- Latest upload per store only (no double-counting)
- Accurate advisor-level performance tracking
- Automated upload processing for known entities

**Multi-Store Support:** ✅ COMPLETE
- Individual store tabs with accurate data separation
- Rollup views for combined performance
- Proper store-to-advisor relationships

**Auto-Processing:** ✅ WORKING
- Eliminates 15-minute manual review process
- Automatic entity matching and mapping
- Service Writers (advisor) tab processing complete

---

*Last Updated: August 1, 2025*
*For questions or clarifications, refer to the main [PROJECT-STATUS.md](../PROJECT-STATUS.md)*