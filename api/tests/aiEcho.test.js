const { build } = require('../services/promptBuilders/scorecardPrompt');
const AIDataService = require('../services/aiDataService');
const OllamaService = require('../services/ollamaService');

// Mock pool for testing
const mockPool = {
  query: jest.fn()
};

describe('AI Echo Tests', () => {
  let aiDataService;
  let ollamaService;

  beforeEach(() => {
    aiDataService = new AIDataService(mockPool);
    ollamaService = new OllamaService(mockPool);
    
    // Mock Ollama response
    ollamaService.generateResponse = jest.fn();
  });

  it('should build JSON-only prompt with exact metrics', () => {
    const metrics = { 
      invoices: 27, 
      sales: 11183, 
      gpSales: 5400, 
      gpPercent: 48.3, 
      retailTires: 38, 
      allTires: 38 
    };
    
    const prompt = build({ 
      advisor: 'Cody Lanier', 
      period: '2025-08', 
      metrics 
    });
    
    expect(prompt).toContain('"advisor": "Cody Lanier"');
    expect(prompt).toContain('"period": "2025-08"');
    expect(prompt).toContain('"invoices": 27');
    expect(prompt).toContain('"sales": 11183');
    expect(prompt).toContain('"gpSales": 5400');
    expect(prompt).toContain('"gpPercent": 48');
    expect(prompt).toContain('"retailTires": 38');
    expect(prompt).toContain('"allTires": 38');
  });

  it('AI echoes exact numbers (no currency)', async () => {
    const metrics = { 
      invoices: 27, 
      sales: 11183, 
      gpSales: 5400, 
      gpPercent: 48, 
      retailTires: 38, 
      allTires: 38 
    };
    
    const mockAIResponse = JSON.stringify({
      advisor: 'Cody Lanier',
      period: '2025-08',
      ...metrics
    });
    
    // Test validation with matching data
    const validatedData = aiDataService.validateScorecardResponse(mockAIResponse, metrics);
    
    expect(validatedData).toEqual(expect.objectContaining(metrics));
  });

  it('should throw error on numeric mismatch', () => {
    const sourceMetrics = { 
      invoices: 27, 
      sales: 11183, 
      gpSales: 5400, 
      gpPercent: 48, 
      retailTires: 38, 
      allTires: 38 
    };
    
    const fakeAIResponse = JSON.stringify({
      advisor: 'Cody Lanier',
      period: '2025-08',
      invoices: 516, // Wrong!
      sales: 316961, // Wrong!
      gpSales: 147882, // Wrong!
      gpPercent: 46.66, // Wrong!
      retailTires: 606, // Wrong!
      allTires: 640 // Wrong!
    });
    
    expect(() => {
      aiDataService.validateScorecardResponse(fakeAIResponse, sourceMetrics);
    }).toThrow('Fabrication in field "sales" – AI:316961 vs API:11183');
  });

  it('should throw error if AI returns invalid JSON', () => {
    const sourceMetrics = { sales: 11183 };
    const invalidResponse = 'This is not JSON';
    
    expect(() => {
      aiDataService.validateScorecardResponse(invalidResponse, sourceMetrics);
    }).toThrow('AI did not return valid JSON');
  });

  it('should handle missing fields as zeros', () => {
    const sourceMetrics = { 
      invoices: 0, 
      sales: 0,
      retailTires: 0
    };
    
    const aiResponse = JSON.stringify({
      advisor: 'Test User',
      period: '2025-01',
      invoices: 0,
      sales: 0,
      retailTires: 0
    });
    
    const validatedData = aiDataService.validateScorecardResponse(aiResponse, sourceMetrics);
    
    expect(validatedData.invoices).toBe(0);
    expect(validatedData.sales).toBe(0);
    expect(validatedData.retailTires).toBe(0);
  });
});