const crypto = require('crypto');

async function runTests() {
  console.log('='.repeat(80));
  console.log('SECURITY BACKEND - COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(80));

  const tests = [];

  // Helper to calculate HMAC using the backend
  async function getCorrectHmac(payload) {
    const response = await fetch('http://localhost:3000/api/test/calculate-hmac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data.hmac;
  }

  // Test 1: Valid Request
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: VALID REQUEST');
    console.log('='.repeat(80));
    
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    
    const hmac = await getCorrectHmac(payload);
    const body = { ...payload, hmac };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(body, null, 2));
    
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Valid Request',
      status: response.status === 200 ? 'PASS' : 'FAIL',
      expected: 200,
      actual: response.status,
    });
  }

  // Test 2: Invalid HMAC
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: INVALID HMAC');
    console.log('='.repeat(80));
    
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
      hmac: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // Wrong HMAC
    };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(payload, null, 2));
    
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Invalid HMAC',
      status: response.status === 403 ? 'PASS' : 'FAIL',
      expected: 403,
      actual: response.status,
    });
  }

  // Test 3: Invalid HMAC Format
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: INVALID HMAC FORMAT');
    console.log('='.repeat(80));
    
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
      hmac: 'not-a-valid-hex', // Invalid format
    };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(payload, null, 2));
    
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Invalid HMAC Format',
      status: response.status === 403 ? 'PASS' : 'FAIL',
      expected: 403,
      actual: response.status,
    });
  }

  // Test 4: Invalid Signature
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 4: INVALID SIGNATURE (NOT IN ALLOWLIST)');
    console.log('='.repeat(80));
    
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // Not in allowlist
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    
    const hmac = await getCorrectHmac(payload);
    const body = { ...payload, hmac };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(body, null, 2));
    
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Invalid Signature',
      status: response.status === 403 ? 'PASS' : 'FAIL',
      expected: 403,
      actual: response.status,
    });
  }

  // Test 5: Expired Timestamp
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 5: EXPIRED TIMESTAMP (10 MINUTES OLD)');
    console.log('='.repeat(80));
    
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes old
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    
    const hmac = await getCorrectHmac(payload);
    const body = { ...payload, hmac };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(body, null, 2));
    
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Expired Timestamp',
      status: response.status === 403 ? 'PASS' : 'FAIL',
      expected: 403,
      actual: response.status,
    });
  }

  // Test 6: Replay Attack
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 6: REPLAY ATTACK (REUSE SAME NONCE)');
    console.log('='.repeat(80));
    
    const nonce = crypto.randomBytes(32).toString('hex');
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce,
    };
    
    const hmac = await getCorrectHmac(payload);
    const body = { ...payload, hmac };
    
    console.log('\nFIRST REQUEST (SHOULD SUCCEED):');
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(body, null, 2));
    
    const response1 = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data1 = await response1.json();
    console.log('\nHTTP STATUS:', response1.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data1, null, 2));
    
    console.log('\n' + '-'.repeat(80));
    console.log('SECOND REQUEST WITH SAME NONCE (SHOULD FAIL - REPLAY ATTACK):');
    
    const payload2 = { ...payload, timestamp: Date.now() };
    const hmac2 = await getCorrectHmac(payload2);
    const body2 = { ...payload2, hmac: hmac2 };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(body2, null, 2));
    
    const response2 = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body2),
    });
    
    const data2 = await response2.json();
    console.log('\nHTTP STATUS:', response2.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data2, null, 2));
    
    tests.push({
      name: 'Replay Attack',
      status: response2.status === 403 ? 'PASS' : 'FAIL',
      expected: 403,
      actual: response2.status,
    });
  }

  // Test 7: Invalid Nonce Format
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 7: INVALID NONCE FORMAT (TOO SHORT)');
    console.log('='.repeat(80));
    
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: 'short', // Too short - must be 64 hex chars
      hmac: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    
    console.log('\nREQUEST BODY:');
    console.log(JSON.stringify(payload, null, 2));
    
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Invalid Nonce Format',
      status: response.status === 403 ? 'PASS' : 'FAIL',
      expected: 403,
      actual: response.status,
    });
  }

  // Test 8: Health Endpoint
  {
    console.log('\n' + '='.repeat(80));
    console.log('TEST 8: HEALTH ENDPOINT');
    console.log('='.repeat(80));
    
    console.log('\nREQUEST: GET /api/health');
    console.log('(No request body)');
    
    const response = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
    });
    
    const data = await response.json();
    console.log('\nHTTP STATUS:', response.status);
    console.log('\nRESPONSE BODY:');
    console.log(JSON.stringify(data, null, 2));
    
    tests.push({
      name: 'Health Endpoint',
      status: response.status === 200 ? 'PASS' : 'FAIL',
      expected: 200,
      actual: response.status,
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = tests.filter(t => t.status === 'PASS').length;
  const failed = tests.filter(t => t.status === 'FAIL').length;
  
  tests.forEach((test, index) => {
    const statusSymbol = test.status === 'PASS' ? '✓' : '✗';
    console.log(`${statusSymbol} ${index + 1}. ${test.name}: ${test.status} (Expected ${test.expected}, Got ${test.actual})`);
  });
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  console.log('='.repeat(80));
}

runTests().catch(console.error);
