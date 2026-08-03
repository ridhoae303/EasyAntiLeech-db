const crypto = require('crypto');

async function testVerification() {
  console.log('=== Integrated Backend Verification Test ===\n');

  // Step 1: Create payload
  const payload = {
    packageName: 'com.example.app',
    sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
    androidVersion: '14',
    deviceModel: 'Pixel 7',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(32).toString('hex'),
  };

  console.log('1. Generated payload:');
  console.log(JSON.stringify(payload, null, 2));

  // Step 2: Get correct HMAC from backend
  console.log('\n2. Requesting correct HMAC from backend...');
  const hmacResponse = await fetch('http://localhost:3000/api/test/calculate-hmac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const hmacData = await hmacResponse.json();
  console.log('HMAC calculation result:');
  console.log('  HMAC:', hmacData.hmac);
  console.log('  Format valid:', hmacData.hmac_valid_format);

  // Step 3: Send verification request with correct HMAC
  console.log('\n3. Sending verification request...');
  const verifyRequest = { ...payload, hmac: hmacData.hmac };

  const verifyResponse = await fetch('http://localhost:3000/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(verifyRequest),
  });

  const verifyData = await verifyResponse.json();
  console.log('Verification response:');
  console.log('  HTTP Status:', verifyResponse.status);
  console.log('  Response:', JSON.stringify(verifyData, null, 2));

  // Step 4: Check result
  console.log('\n4. Test Result:');
  if (verifyResponse.status === 200 && (verifyData.status === 'allowed' || verifyData.status === 'accepted')) {
    console.log('✓ SUCCESS: Valid request accepted!');
    return true;
  } else {
    console.log('✗ FAILED: Request rejected');
    console.log('  Reason:', verifyData.reason);
    return false;
  }
}

testVerification().catch(console.error);
