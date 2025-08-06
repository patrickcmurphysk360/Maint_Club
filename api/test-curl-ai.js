const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 1, role: 'admin', service: 'test' },
  process.env.JWT_SECRET || 'maintenance_club_jwt_secret_change_in_production',
  { expiresIn: '5m' }
);

console.log('Test with this curl command:');
console.log(`curl -X POST http://localhost:5000/api/ai-insights/scorecard \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{"advisorId": 244, "period": "2025-08"}'`);