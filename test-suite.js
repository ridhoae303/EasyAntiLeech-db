const crypto = require('crypto');

const tests = [];

async function test(name, fn) {
  try {
    const result = await fn();
    tests.push({ name, passed: result, error: null });
    console.log(result ? '✓' : '✗', name);
  } catch (error) {
    tests.push({ name, passed: false, error: error.message });
    console.log('✗', name, '-', error.message);
  }
}

async function getCorrectHmac(payload) {
  const response = await fetch('http://localhost:3000/api/test/calculate-hmac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return data.hmac;
}

async function verify(request) {
  const response = await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return { status: response.status, data: await response.json() };
}

(async () => {
  console.log('=== Production-Ready Backend Test Suite ===\n');

  // Test 1: Valid request
  await test('Valid request with correct HMAC returns 200', async () => {
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    const hmac = await getCorrectHmac(payload);
    const result = await verify({ ...payload, hmac });
    return result.status === 200 && result.data.status === 'allowed';
  });

  // Test 2: Invalid HMAC
  await test('Invalid HMAC returns 403', async () => {
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
      hmac: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const result = await verify(payload);
    return result.status === 403 && result.data.reason.includes('HMAC');
  });

  // Test 3: Invalid HMAC format
  await test('Invalid HMAC format returns 403', async () => {
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
      hmac: 'not-hex-format',
    };
    const result = await verify(payload);
    return result.status === 403 && result.data.reason.includes('Invalid');
  });

  // Test 4: Invalid signature
  await test('Invalid signature returns 403', async () => {
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // Not in allowlist
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    const hmac = await getCorrectHmac(payload);
    const result = await verify({ ...payload, hmac });
    return result.status === 403 && (result.data.reason.includes('SIGNATURE') || result.data.reason.includes('signature'));
  });

  // Test 5: Expired timestamp
  await test('Expired timestamp returns 403', async () => {
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes old
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    const hmac = await getCorrectHmac(payload);
    const result = await verify({ ...payload, hmac });
    return result.status === 403 && (result.data.reason.includes('expired') || result.data.reason.includes('Timestamp'));
  });

  // Test 6: Replay attack - same nonce
  await test('Replay attack (same nonce) returns 403', async () => {
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
    const request = { ...payload, hmac };
    
    // First request should succeed
    const result1 = await verify(request);
    if (result1.status !== 200) return false;
    
    // Second request with same nonce should fail (but timestamp must be updated)
    const request2 = { ...request, timestamp: Date.now() };
    const hmac2 = await getCorrectHmac({ ...payload, timestamp: request2.timestamp });
    const result2 = await verify({ ...request2, hmac: hmac2 });
    return result2.status === 403 && (result2.data.reason.includes('replay') || result2.data.reason.includes('REPLAY'));
  });

  // Test 7: Invalid nonce format
  await test('Invalid nonce format returns 403', async () => {
    const payload = {
      packageName: 'com.example.app',
      sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
      androidVersion: '14',
      deviceModel: 'Pixel 7',
      timestamp: Date.now(),
      nonce: 'short-nonce', // Too short
      hmac: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // dummy
    };
    const result = await verify(payload);
    return result.status === 403 && (result.data.reason.includes('nonce') || result.data.reason.includes('Invalid'));
  });

  // Test 8: Health check
  await test('Health check endpoint returns 200', async () => {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    return response.status === 200 && data.status === 'healthy' && data.allowedSignaturesCount === 4;
  });

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('\n✓ All tests passed! Backend is production-ready.');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed:');
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.error || 'assertion failed'}`);
    });
    process.exit(1);
  }
})();
