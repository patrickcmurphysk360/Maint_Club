const express = require('express');
const AIDataService = require('../services/aiDataService');
const router = express.Router();

// Test endpoint to verify AI data access
router.get('/test-market-data/:userId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    
    console.log('🧪 Testing AI data access for user:', userId);
    
    const aiDataService = new AIDataService(pool);
    
    // Get user context
    const userData = await aiDataService.getUserContext(userId);
    console.log('👤 User data:', userData);
    
    // Get market performance for August 2025
    if (userData.market_id) {
      const marketPerf = await aiDataService.getMarketPerformanceData(userData.market_id, 8, 2025);
      console.log('📊 Market performance for August 2025:', marketPerf);
      
      res.json({
        user: userData,
        market_performance_august_2025: marketPerf,
        message: 'AI has access to this real data!'
      });
    } else {
      res.json({
        user: userData,
        message: 'User not assigned to a market'
      });
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;