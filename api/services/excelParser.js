const XLSX = require('xlsx');

class ExcelParser {
  constructor() {
    // Services file columns for advisor rollup
    this.serviceColumns = [
      'ID', 'Market', 'Store', 'Employee', 'Sales', 'GP Sales', 'GP Percent',
      'Avg. Spend', 'Invoices', 'All Tires', 'Retail Tires', 'Tire Protection',
      'Tire Protection %', 'Potential Alignments', 'Potential Alignments Sold',
      'Potential Alignments %', 'Brake Flush to Service %', 'Alignments',
      'Brake Service', 'Brake Flush', 'Oil Change', 'Engine Air Filter',
      'Cabin Air Filter', 'Coolant Flush', 'Differential Service',
      'Fuel System Service', 'Power Steering Flush', 'Transmission Fluid Service',
      'Shocks & Struts', 'Wiper Blades', 'AC Service', 'Battery',
      // Additional columns for MVP
      'Premium Oil Change', 'Fuel Additive', 'Engine Flush', 'Filters'
    ];
    
    // Operations file columns for store-level KPIs
    this.operationsColumns = [
      'ID', 'Market', 'Store', 'Invoices', 'Sales', 'GP $', 'GP %',
      'Labor', 'Labor Hours', 'Labor Average', 'Effective Labor Rate',
      'Tire Units', 'Parts', 'Parts GP $', 'Parts GP %',
      'Supplies', 'Discounts', 'Average RO'
    ];
  }

  parseServicesFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const result = {
        employees: [],
        stores: [],
        markets: [],
        errors: []
      };

      // Parse Service Writers sheet (employee level)
      if (workbook.SheetNames.includes('Service Writers')) {
        const worksheet = workbook.Sheets['Service Writers'];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 1) {
          const headers = data[0];
          const rows = data.slice(1);
          
          result.employees = this.parseServiceData(headers, rows, 'employee');
        }
      }

      // Parse Stores sheet (store level)
      if (workbook.SheetNames.includes('Stores')) {
        const worksheet = workbook.Sheets['Stores'];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 1) {
          const headers = data[0];
          const rows = data.slice(1);
          
          result.stores = this.parseServiceData(headers, rows, 'store');
        }
      }

      // Parse Markets sheet (market level)
      if (workbook.SheetNames.includes('Markets')) {
        const worksheet = workbook.Sheets['Markets'];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 1) {
          const headers = data[0];
          const rows = data.slice(1);
          
          result.markets = this.parseServiceData(headers, rows, 'market');
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to parse Services file: ${error.message}`);
    }
  }

  parseOperationsFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const result = {
        yesterday: [],
        yearOverYear: [],
        errors: []
      };

      // Parse Yesterday sheet
      if (workbook.SheetNames.includes('Yesterday')) {
        const worksheet = workbook.Sheets['Yesterday'];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 1) {
          const headers = data[0];
          const rows = data.slice(1);
          
          result.yesterday = this.parseOperationsData(headers, rows, 'yesterday');
        }
      }

      // Parse Year over Year sheet
      if (workbook.SheetNames.includes('Year over Year')) {
        const worksheet = workbook.Sheets['Year over Year'];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 1) {
          const headers = data[0];
          const rows = data.slice(1);
          
          result.yearOverYear = this.parseOperationsData(headers, rows, 'yoy');
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to parse Operations file: ${error.message}`);
    }
  }

  parseServiceData(headers, rows, dataLevel) {
    const results = [];
    
    rows.forEach((row, index) => {
      if (this.isEmptyRow(row)) return;
      
      const record = {
        dataLevel,
        storeId: this.getCellValue(row, headers, 'ID'),
        market: this.getCellValue(row, headers, 'Market'),
        storeName: this.getCellValue(row, headers, 'Store'),
        employeeName: dataLevel === 'employee' ? this.getCellValue(row, headers, 'Employee') : null,
        
        // Financial metrics
        sales: this.parseNumber(this.getCellValue(row, headers, 'Sales')),
        gpSales: this.parseNumber(this.getCellValue(row, headers, 'GP Sales')),
        gpPercent: this.parsePercent(this.getCellValue(row, headers, 'GP Percent')),
        avgSpend: this.parseNumber(this.getCellValue(row, headers, 'Avg. Spend')),
        invoices: this.parseInt(this.getCellValue(row, headers, 'Invoices')),
        
        // Tire metrics
        allTires: this.parseInt(this.getCellValue(row, headers, 'All Tires')),
        retailTires: this.parseInt(this.getCellValue(row, headers, 'Retail Tires')),
        tireProtection: this.parseNumber(this.getCellValue(row, headers, 'Tire Protection')),
        tireProtectionPercent: this.parsePercent(this.getCellValue(row, headers, 'Tire Protection %')),
        potentialAlignments: this.parseInt(this.getCellValue(row, headers, 'Potential Alignments')),
        potentialAlignmentsSold: this.parseInt(this.getCellValue(row, headers, 'Potential Alignments Sold')),
        potentialAlignmentsPercent: this.parsePercent(this.getCellValue(row, headers, 'Potential Alignments %')),
        brakeFlushToServicePercent: this.parsePercent(this.getCellValue(row, headers, 'Brake Flush to Service %')),
        
        // Service categories
        alignments: this.parseNumber(this.getCellValue(row, headers, 'Alignments')),
        brakeService: this.parseNumber(this.getCellValue(row, headers, 'Brake Service')),
        brakeFlush: this.parseNumber(this.getCellValue(row, headers, 'Brake Flush')),
        oilChange: this.parseNumber(this.getCellValue(row, headers, 'Oil Change')),
        engineAirFilter: this.parseNumber(this.getCellValue(row, headers, 'Engine Air Filter')),
        cabinAirFilter: this.parseNumber(this.getCellValue(row, headers, 'Cabin Air Filter')),
        coolantFlush: this.parseNumber(this.getCellValue(row, headers, 'Coolant Flush')),
        differentialService: this.parseNumber(this.getCellValue(row, headers, 'Differential Service')),
        fuelSystemService: this.parseNumber(this.getCellValue(row, headers, 'Fuel System Service')),
        powerSteeringFlush: this.parseNumber(this.getCellValue(row, headers, 'Power Steering Flush')),
        transmissionFluidService: this.parseNumber(this.getCellValue(row, headers, 'Transmission Fluid Service')),
        shocksStruts: this.parseNumber(this.getCellValue(row, headers, 'Shocks & Struts')),
        wiperBlades: this.parseNumber(this.getCellValue(row, headers, 'Wiper Blades')),
        acService: this.parseNumber(this.getCellValue(row, headers, 'AC Service')),
        battery: this.parseNumber(this.getCellValue(row, headers, 'Battery')),
        
        // MVP-specific service categories
        premiumOilChange: this.parseNumber(this.getCellValue(row, headers, 'Premium Oil Change')),
        fuelAdditive: this.parseNumber(this.getCellValue(row, headers, 'Fuel Additive')),
        engineFlush: this.parseNumber(this.getCellValue(row, headers, 'Engine Flush')),
        filters: this.parseNumber(this.getCellValue(row, headers, 'Filters')),
        
        // Store additional services as JSON
        otherServices: this.extractOtherServices(headers, row)
      };
      
      results.push(record);
    });
    
    return results;
  }

  parseOperationsData(headers, rows, reportType) {
    const results = [];
    
    rows.forEach((row, index) => {
      if (this.isEmptyRow(row)) return;
      
      let storeId = this.getCellValue(row, headers, 'ID') || 
                   this.getCellValue(row, headers, 'Store ID') ||
                   this.getCellValue(row, headers, 'Store Id') ||
                   this.getCellValue(row, headers, 'StoreID') ||
                   this.getCellValue(row, headers, 'Store_ID');
      
      if (!storeId) {
        const storeName = this.getCellValue(row, headers, 'Store');
        if (storeName) {
          storeId = storeName.toLowerCase().replace(/\s+/g, '_');
        }
      }
      
      if (!storeId) {
        return;
      }
      
      const record = {
        reportType,
        storeId: storeId,
        market: this.getCellValue(row, headers, 'Market'),
        storeName: this.getCellValue(row, headers, 'Store'),
        dataLevel: 'store',
        
        // Store-level KPIs for MVP
        invoices: this.parseInt(this.getCellValue(row, headers, 'Invoices')),
        sales: this.parseNumber(this.getCellValue(row, headers, 'Sales')),
        gpDollars: this.parseNumber(this.getCellValue(row, headers, 'GP $')),
        gpPercent: this.parsePercent(this.getCellValue(row, headers, 'GP %')),
        
        // Labor metrics
        labor: this.parseNumber(this.getCellValue(row, headers, 'Labor')),
        laborHours: this.parseNumber(this.getCellValue(row, headers, 'Labor Hours')),
        laborAverage: this.parseNumber(this.getCellValue(row, headers, 'Labor Average')),
        effectiveLaborRate: this.parseNumber(this.getCellValue(row, headers, 'Effective Labor Rate')),
        
        // Parts and tire metrics
        tireUnits: this.parseInt(this.getCellValue(row, headers, 'Tire Units')),
        parts: this.parseNumber(this.getCellValue(row, headers, 'Parts')),
        partsGpDollars: this.parseNumber(this.getCellValue(row, headers, 'Parts GP $')),
        partsGpPercent: this.parsePercent(this.getCellValue(row, headers, 'Parts GP %')),
        
        // Other metrics
        supplies: this.parseNumber(this.getCellValue(row, headers, 'Supplies')),
        discounts: this.parseNumber(this.getCellValue(row, headers, 'Discounts')),
        averageRO: this.parseNumber(this.getCellValue(row, headers, 'Average RO'))
      };
      
      if (reportType === 'yoy') {
        record.yoyMetrics = this.extractYoyMetrics(headers, row);
      }
      
      results.push(record);
    });
    
    return results;
  }

  // Helper methods
  getCellValue(row, headers, columnName) {
    const index = headers.findIndex(h => h && h.toString().toLowerCase().includes(columnName.toLowerCase()));
    return index >= 0 ? row[index] : null;
  }

  parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value.toString().replace(/[$,]/g, ''));
    return isNaN(num) ? null : num;
  }

  parseInt(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value.toString().replace(/[,]/g, ''));
    return isNaN(num) ? null : num;
  }

  parsePercent(value) {
    if (value === null || value === undefined || value === '') return null;
    let str = value.toString().replace('%', '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  isEmptyRow(row) {
    return !row || row.every(cell => cell === null || cell === undefined || cell === '');
  }

  extractOtherServices(headers, row) {
    const otherServices = {};
    const knownServices = new Set([
      'alignments', 'brake service', 'brake flush', 'oil change', 
      'engine air filter', 'cabin air filter', 'coolant flush', 
      'differential service', 'fuel system service', 'power steering flush',
      'transmission fluid service', 'shocks & struts', 'wiper blades', 
      'ac service', 'battery', 'premium oil change', 'fuel additive', 
      'engine flush', 'filters'
    ]);
    
    headers.forEach((header, index) => {
      if (header && !knownServices.has(header.toLowerCase()) && 
          !['id', 'market', 'store', 'employee', 'sales', 'gp sales', 'gp percent', 
            'avg. spend', 'invoices', 'all tires', 'retail tires', 'tire protection',
            'tire protection %', 'potential alignments', 'potential alignments sold',
            'potential alignments %', 'brake flush to service %'].includes(header.toLowerCase())) {
        const value = this.parseNumber(row[index]);
        if (value !== null) {
          otherServices[header] = value;
        }
      }
    });
    
    return Object.keys(otherServices).length > 0 ? otherServices : null;
  }

  extractYoyMetrics(headers, row) {
    const yoyMetrics = {};
    
    headers.forEach((header, index) => {
      if (header && (header.includes('+/-') || header.includes('%'))) {
        const value = this.parsePercent(row[index]);
        if (value !== null) {
          yoyMetrics[header] = value;
        }
      }
    });
    
    return Object.keys(yoyMetrics).length > 0 ? yoyMetrics : null;
  }
  
  // Extract unique advisor names from services data for mapping
  extractUniqueAdvisors(servicesData) {
    const advisorSet = new Set();
    
    if (servicesData.employees) {
      servicesData.employees.forEach(employee => {
        if (employee.employeeName) {
          advisorSet.add(employee.employeeName);
        }
      });
    }
    
    return Array.from(advisorSet).sort();
  }
  
  // Parse filename to extract market ID, date, time, type, and hash
  parseFileName(filename) {
    // New format: "market_id-YYYY-MM-DD-time-type-hash.xlsx"
    // Example: "694-2025-07-24-6am-Services-YlxBy3y5-1753351620.xlsx"
    
    // Also support legacy format for backward compatibility
    // Legacy: "Market Name - System - Type - YYYY-MM-DD.xlsx"
    
    const base = filename.replace('.xlsx', '');
    
    // Check if it's the new format (contains numeric market_id at start)
    if (/^\d+-.+/.test(base)) {
      const tokens = base.split('-');
      
      if (tokens.length >= 6) {
        // New format parsing
        const marketId = tokens[0];
        const year = tokens[1];
        const month = tokens[2];
        const day = tokens[3];
        const time = tokens[4];
        const type = tokens[5];
        const hash = tokens.length > 6 ? tokens.slice(6).join('-') : '';
        
        // Validate date components
        if (year.length === 4 && month.length === 2 && day.length === 2) {
          const dateStr = `${year}-${month}-${day}`;
          const date = new Date(dateStr);
          
          // Validate the date is valid
          if (!isNaN(date.getTime())) {
            return {
              marketId: marketId,
              market: `Market ${marketId}`, // Fallback market name
              date: date,
              time: time,
              type: type.toLowerCase(), // 'services' or 'operations'
              hash: hash,
              format: 'new',
              isValid: true
            };
          }
        }
      }
      
      return {
        isValid: false,
        error: 'Invalid new filename format. Expected: "market_id-YYYY-MM-DD-time-type-hash.xlsx"'
      };
    } else {
      // Legacy format parsing
      const parts = base.split(' - ');
      
      if (parts.length >= 4) {
        const dateMatch = parts[parts.length - 1].match(/(\d{4})-(\d{2})-(\d{2})/);
        
        return {
          market: parts[0],
          system: parts[1],
          type: parts[2].toLowerCase(), // 'services' or 'operations'
          date: dateMatch ? new Date(dateMatch[0]) : new Date(),
          format: 'legacy',
          isValid: true
        };
      }
      
      return {
        isValid: false,
        error: 'Invalid legacy filename format. Expected: "Market - System - Type - YYYY-MM-DD.xlsx"'
      };
    }
  }
}

module.exports = ExcelParser;