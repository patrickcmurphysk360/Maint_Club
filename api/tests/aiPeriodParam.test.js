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

describe('AI Scorecard Period Parameter Tests', () => {
  let testToken;
  
  beforeEach(() => {
    testToken = generateTestToken();
  });

  it('returns real August numbers, not zeros via AI endpoint', async () => {
    const response = await request(app)
      .post('/api/ai-insights/scorecard')
      .send({ advisorId: 244, period: '2025-08' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    // These should be the real August numbers, not zeros
    expect(data.sales).toBe(11183);
    expect(data.invoices).toBe(27);
    expect(data.retailTires).toBe(38);
    expect(data.advisor).toBe('Cody Lanier');
    expect(data.period).toBe('2025-08');
  });

  it('should handle current period when no period specified', async () => {
    const response = await request(app)
      .post('/api/ai-insights/scorecard')
      .send({ advisorId: 244 })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    const data = response.body;
    
    // Should still return data, just not for specific period
    expect(data).toHaveProperty('sales');
    expect(data).toHaveProperty('invoices');
    expect(data).toHaveProperty('advisor');
    expect(data.advisor).toBe('Cody Lanier');
  });

  it('should return 404 for non-existent advisor', async () => {
    const response = await request(app)
      .post('/api/ai-insights/scorecard')
      .send({ advisorId: 99999, period: '2025-08' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(404);

    expect(response.body.message).toBe('Advisor not found');
  });

  it('should return 400 when advisorId missing', async () => {
    const response = await request(app)
      .post('/api/ai-insights/scorecard')
      .send({ period: '2025-08' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(400);

    expect(response.body.message).toBe('advisorId is required');
  });
});