const request = require('supertest');
const jwt = require('jsonwebtoken');

// Create the app by importing server.js properly
const app = require('../server');

const generateTestToken = () => {
  return jwt.sign(
    { id: 1, role: 'admin', service: 'test' },
    process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
    { expiresIn: '5m' }
  );
};

describe('Scorecard API Tests', () => {
  let testToken;
  
  beforeEach(() => {
    testToken = generateTestToken();
  });

  it('returns Cody August numbers > 0 with period parameter', async () => {
    const response = await request(app)
      .get('/api/scorecard/advisor/244')
      .query({ period: '2025-08' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    // Test the core metrics that should match our DB data
    expect(data.metrics.invoices).toBe(27);
    expect(data.metrics.sales).toBe(11183);
    expect(data.metrics.gpSales).toBe(4858);
    expect(data.metrics.gpPercent).toBe(44);
    
    // Test service-level fields
    expect(data.services['Retail Tires']).toBe(38);
    expect(data.services['All Tires']).toBe(38);
    expect(data.services['Alignments']).toBe(9);
    expect(data.services['Oil Change']).toBe(4);
  });

  it('returns Cody August numbers > 0 with mtdMonth/mtdYear parameters', async () => {
    const response = await request(app)
      .get('/api/scorecard/advisor/244')
      .query({ mtdMonth: '8', mtdYear: '2025' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    // Should get the same results as period parameter
    expect(data.metrics.invoices).toBe(27);
    expect(data.metrics.sales).toBe(11183);
    expect(data.services['Retail Tires']).toBe(38);
  });

  it('should have proper structure for validation utility', async () => {
    const response = await request(app)
      .get('/api/scorecard/advisor/244')
      .query({ period: '2025-08' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    // Check structure expected by validation utility
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('services');
    expect(data.metrics).toHaveProperty('sales');
    expect(data.metrics).toHaveProperty('invoices');
    expect(data.services).toHaveProperty('Retail Tires');
  });

  it('should return zeros for non-existent advisor', async () => {
    const response = await request(app)
      .get('/api/scorecard/advisor/99999')
      .query({ period: '2025-08' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    expect(data.metrics.sales).toBe(0);
    expect(data.metrics.invoices).toBe(0);
  });

  it('should handle invalid period format gracefully', async () => {
    const response = await request(app)
      .get('/api/scorecard/advisor/244')
      .query({ period: 'invalid-format' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    // Should fall back to date range query (may return aggregate data)
    expect(data.metrics).toBeDefined();
    expect(data.metrics.sales).toBeGreaterThanOrEqual(0);
  });
});