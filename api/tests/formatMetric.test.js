/**
 * Unit tests for formatMetric function to validate type-aware formatting
 * Tests the fix for the "$38,000" units bug where retailTires and allTires
 * were being incorrectly formatted as currency values
 */

const { formatMetric, FIELD_TYPES } = require('../config/aiPrompts');

describe('formatMetric Function - Type-Aware Formatting', () => {
  
  test('Currency fields should be formatted with dollar signs', () => {
    expect(formatMetric('sales', 145537)).toBe('$145,537');
    expect(formatMetric('gpSales', 68396)).toBe('$68,396');
    expect(formatMetric('totalSales', 250000)).toBe('$250,000');
  });

  test('Unit count fields should NOT be formatted with dollar signs', () => {
    expect(formatMetric('retailTires', 228)).toBe('228');
    expect(formatMetric('allTires', 248)).toBe('248');
    expect(formatMetric('invoices', 246)).toBe('246');
    expect(formatMetric('alignments', 64)).toBe('64');
    expect(formatMetric('oilChange', 29)).toBe('29');
    expect(formatMetric('brakeService', 27)).toBe('27');
  });

  test('Percentage fields should be formatted with percent signs', () => {
    expect(formatMetric('gpPercent', 47)).toBe('47%');
    expect(formatMetric('tireProtectionPercent', 83)).toBe('83%');
  });

  test('Unknown fields with numeric values should default to unit formatting', () => {
    expect(formatMetric('unknownField', 1234)).toBe('1,234');
    expect(formatMetric('someRandomMetric', 500)).toBe('500');
  });

  test('Null and undefined values should return "N/A"', () => {
    expect(formatMetric('sales', null)).toBe('N/A');
    expect(formatMetric('retailTires', undefined)).toBe('N/A');
    expect(formatMetric('gpPercent', '')).toBe('N/A');
  });

  test('FIELD_TYPES mapping contains correct tire fields as units', () => {
    expect(FIELD_TYPES.units).toContain('retailTires');
    expect(FIELD_TYPES.units).toContain('allTires');
    expect(FIELD_TYPES.currency).not.toContain('retailTires');
    expect(FIELD_TYPES.currency).not.toContain('allTires');
  });

  test('Large numbers should be formatted with commas', () => {
    expect(formatMetric('sales', 1234567)).toBe('$1,234,567');
    expect(formatMetric('retailTires', 1234)).toBe('1,234');
    expect(formatMetric('allTires', 12345)).toBe('12,345');
  });

  test('String numbers should be converted and formatted correctly', () => {
    expect(formatMetric('sales', '145537')).toBe('$145,537');
    expect(formatMetric('retailTires', '228')).toBe('228');
    expect(formatMetric('gpPercent', '47')).toBe('47%');
  });

});

describe('FIELD_TYPES Configuration', () => {
  
  test('All expected currency fields are present', () => {
    const expectedCurrency = ['sales', 'gpSales', 'totalSales', 'totalGpSales'];
    expectedCurrency.forEach(field => {
      expect(FIELD_TYPES.currency).toContain(field);
    });
  });

  test('All expected unit fields are present', () => {
    const expectedUnits = ['retailTires', 'allTires', 'invoices', 'alignments', 'oilChange'];
    expectedUnits.forEach(field => {
      expect(FIELD_TYPES.units).toContain(field);
    });
  });

  test('No field appears in multiple categories', () => {
    const allFields = [
      ...FIELD_TYPES.currency,
      ...FIELD_TYPES.units,
      ...FIELD_TYPES.percentage
    ];
    const uniqueFields = new Set(allFields);
    expect(allFields.length).toBe(uniqueFields.size);
  });
  
});