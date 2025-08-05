const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendor');
const vendorMappingsRoutes = require('./routes/vendor-mappings');
const vendorPartnersRoutes = require('./routes/vendor-partners');
const performanceRoutes = require('./routes/performance');
const scorecardRoutes = require('./routes/scorecard');
const goalsRoutes = require('./routes/goals');
const coachingRoutes = require('./routes/coaching-enhanced');
const exportRoutes = require('./routes/export');
const usersRoutes = require('./routes/users');
const advisorMappingsRoutes = require('./routes/advisor-mappings');
const scorecardTemplatesRoutes = require('./routes/scorecard-templates');

// Additional routes
const enhancedUploadRoutes = require('./routes/enhanced-upload');
const serviceCatalogRoutes = require('./routes/service-catalog');
const servicesManagementRoutes = require('./routes/services-management');
const marketsRoutes = require('./routes/markets');
const storesRoutes = require('./routes/stores');
const dataManagementRoutes = require('./routes/data-management');
const dataAuditRoutes = require('./routes/data-audit');
const fieldMappingsRoutes = require('./routes/field-mappings');
const aiInsightsRoutes = require('./routes/ai-insights');
const aiConfigRoutes = require('./routes/ai-config');
const aiSettingsRoutes = require('./routes/ai-settings');
const aiBenchmarksRoutes = require('./routes/ai-benchmarks');
const aiValidationDashboardRoutes = require('./routes/ai-validation-dashboard');
const aiPolicyCheckRoutes = require('./routes/ai-policy-check');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3007', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PostgreSQL connection pool
console.log('Database config:', {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'maintenance_club_mvp',
  password: process.env.POSTGRES_PASSWORD ? '[MASKED]' : 'undefined',
  port: process.env.POSTGRES_PORT || 5432,
});

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'maintenance_club_mvp',
  password: process.env.POSTGRES_PASSWORD || 'ducks2020',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Make pool available to routes
app.locals.pool = pool;

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully at', res.rows[0].now);
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendor', authenticateToken, vendorRoutes);
app.use('/api/vendor-mappings', authenticateToken, vendorMappingsRoutes);
app.use('/api/vendor-partners', authenticateToken, vendorPartnersRoutes);
app.use('/api/performance', authenticateToken, performanceRoutes);
app.use('/api/scorecard', authenticateToken, scorecardRoutes);
app.use('/api/goals', authenticateToken, goalsRoutes);
app.use('/api/coaching', authenticateToken, coachingRoutes);
app.use('/api/export', authenticateToken, exportRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/advisor-mappings', authenticateToken, advisorMappingsRoutes);
app.use('/api/scorecard-templates', authenticateToken, scorecardTemplatesRoutes);

// Additional routes
app.use('/api/enhanced-upload', authenticateToken, enhancedUploadRoutes);
app.use('/api/service-catalog', authenticateToken, serviceCatalogRoutes);
app.use('/api/services-management', authenticateToken, servicesManagementRoutes);
app.use('/api/markets', authenticateToken, marketsRoutes);
app.use('/api/stores', authenticateToken, storesRoutes);
app.use('/api/data-management', authenticateToken, dataManagementRoutes);
app.use('/api/data-audit', authenticateToken, dataAuditRoutes);
app.use('/api/field-mappings', authenticateToken, fieldMappingsRoutes);
app.use('/api/ai-insights', authenticateToken, aiInsightsRoutes);
app.use('/api/ai-config', authenticateToken, aiConfigRoutes);
app.use('/api/ai-settings', authenticateToken, aiSettingsRoutes);
app.use('/api/ai-benchmarks', authenticateToken, aiBenchmarksRoutes);
app.use('/api/ai-validation', authenticateToken, aiValidationDashboardRoutes);
app.use('/api/ai-policy-check', authenticateToken, aiPolicyCheckRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'Maintenance Club MVP API',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Maintenance Club MVP API',
    version: '1.0.0',
    description: 'Performance management portal for automotive service shops',
    endpoints: {
      auth: '/api/auth',
      vendor: '/api/vendor',
      performance: '/api/performance', 
      scorecard: '/api/scorecard',
      goals: '/api/goals',
      coaching: '/api/coaching',
      export: '/api/export',
      users: '/api/users'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Maintenance Club MVP API running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: ${process.env.POSTGRES_DB} on ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`);
});