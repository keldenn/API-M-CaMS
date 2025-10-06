// Test script to demonstrate different JWT error messages
const https = require('http');

const baseUrl = 'http://localhost:3000';

// Test cases
const testCases = [
  {
    name: 'Valid Token Test',
    token: 'Bearer valid_token_here', // This will be replaced with actual token
    expectedMessage: 'Should work with valid token'
  },
  {
    name: 'Expired Token Test',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCIsImNkX2NvZGUiOiJURVNUIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTYzMzU2MDAwMCwiZXhwIjoxNjMzNTYwNjAwfQ.invalid_signature',
    expectedMessage: 'Token expired'
  },
  {
    name: 'Invalid Token Test',
    token: 'Bearer invalid_token_format',
    expectedMessage: 'Unauthorized'
  },
  {
    name: 'Wrong Token Type Test',
    token: 'Bearer refresh_token_here', // This will be replaced with actual refresh token
    expectedMessage: 'Invalid token type'
  },
  {
    name: 'No Token Test',
    token: '',
    expectedMessage: 'Unauthorized'
  }
];

async function testEndpoint(token, testName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`\n${testName}:`);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Message: ${response.message}`);
          console.log(`Response: ${JSON.stringify(response, null, 2)}`);
          resolve(response);
        } catch (e) {
          console.log(`\n${testName}:`);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Raw Response: ${data}`);
          resolve({ error: 'Parse error', raw: data });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`\n${testName}: Error - ${e.message}`);
      resolve({ error: e.message });
    });

    // Send test data
    const testData = JSON.stringify({
      currentPassword: 'test',
      newPassword: 'NewPassword123',
      confirmPassword: 'NewPassword123'
    });

    req.write(testData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing JWT Error Messages...\n');
  console.log('=' .repeat(50));
  
  for (const testCase of testCases) {
    await testEndpoint(testCase.token, testCase.name);
    console.log('=' .repeat(50));
  }
  
  console.log('\n✅ Test completed!');
  console.log('\n📝 Expected Results:');
  console.log('1. Valid Token: Should work (200) or validation error (400)');
  console.log('2. Expired Token: "Token expired" (401)');
  console.log('3. Invalid Token: "Unauthorized" (401)');
  console.log('4. Wrong Token Type: "Invalid token type" (401)');
  console.log('5. No Token: "Unauthorized" (401)');
}

runTests().catch(console.error);
