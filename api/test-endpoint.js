// Test the new endpoint directly
const http = require('http');

function testEndpoint() {
  const options = {
    hostname: 'localhost',
    port: 5002,  // Docker port
    path: '/api/users/with-performance-data',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // We need a valid token - let's try without auth first to see the error
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          console.log(`\n✅ Found ${parsed.length} users`);
          parsed.slice(0, 3).forEach(user => {
            console.log(`  - ${user.firstName} ${user.lastName} (${user.role})`);
          });
        }
      } catch (e) {
        console.log('Failed to parse JSON:', e.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
}

console.log('🔍 Testing /api/users/with-performance-data endpoint...');
testEndpoint();