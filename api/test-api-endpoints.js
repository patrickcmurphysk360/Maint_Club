// Test API endpoints are working
const http = require('http');

function makeRequest(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5002,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`${description}: ${res.statusCode} ${res.statusCode === 401 ? '(needs auth - expected)' : res.statusCode === 200 ? '(success)' : '(error)'}`);
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`${description}: ERROR - ${e.message}`);
      resolve();
    });

    req.end();
  });
}

async function testEndpoints() {
  console.log('🔍 Testing API endpoints...\n');
  
  await makeRequest('/health', '✅ Health check');
  await makeRequest('/api/users/with-performance-data', '🆕 New users endpoint');
  await makeRequest('/api/scorecard/advisor/243', '📊 Scorecard endpoint');
  
  console.log('\n💡 All endpoints should return 401 (needs auth) or 200 (success)');
  console.log('🎯 Now try refreshing the browser at: http://localhost:3007');
  console.log('⚠️  Make sure to clear browser cache (Ctrl+Shift+R)');
}

testEndpoints();