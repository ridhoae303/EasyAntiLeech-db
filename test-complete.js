const HmacSHA256 = require('crypto-js/hmac-sha256');
const Hex = require('crypto-js/enc-hex');
const crypto = require('crypto');

if (!process.env.HMAC_SECRET) {
  console.error('Error: HMAC_SECRET environment variable is required');
  process.exit(1);
}

const HMAC_SECRET = process.env.HMAC_SECRET;

console.log('\n=== Android Anti-Leech Verification Test ===\n');

// Test 1: Valid request with correct HMAC
async function testValidRequest() {
  console.log('\n--- Test 1: Valid Request ---');
  
  const payload = {
    packageName: 'com.example.app',
    sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
    androidVersion: '14',
    deviceModel: 'Pixel 7',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(32).toString('hex'),
  };

  // Sort keys exactly like the backend does
  const sorted = Object.keys(payload)
    .sort()
    .reduce((obj, key) => {
      obj[key] = payload[key];
      return obj;
    }, {});

  const message = JSON.stringify(sorted);
  const hmac = HmacSHA256(message, HMAC_SECRET).toString(Hex);

  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('Sorted message:', message);
  console.log('HMAC:', hmac);
  console.log('HMAC length:', hmac.length);
  console.log('HMAC format valid:', /^[a-f0-9]{64}$/.test(hmac));

  const request = { ...payload, hmac };
  
  console.log('\nSending request...');
  try {
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    console.log('HTTP Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 200) {
      console.log('✓ PASS: Valid request accepted');
      return true;
    } else {
      console.log('✗ FAIL: Valid request rejected');
      return false;
    }
  } catch (err) {
    console.error('✗ ERROR:', err.message);
    return false;
  }
}

// Test 2: Invalid HMAC
async function testInvalidHmac() {
  console.log('\n--- Test 2: Invalid HMAC ---');
  
  const payload = {
    packageName: 'com.example.app',
    sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
    androidVersion: '14',
    deviceModel: 'Pixel 7',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(32).toString('hex'),
    hmac: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };

  console.log('Sending request with wrong HMAC...');
  try {
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('HTTP Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 403 && data.reason.includes('HMAC')) {
      console.log('✓ PASS: Invalid HMAC correctly rejected');
      return true;
    } else {
      console.log('✗ FAIL: Invalid HMAC not handled correctly');
      return false;
    }
  } catch (err) {
    console.error('✗ ERROR:', err.message);
    return false;
  }
}

// Test 3: Invalid format
async function testInvalidFormat() {
  console.log('\n--- Test 3: Invalid HMAC Format ---');
  
  const payload = {
    packageName: 'com.example.app',
    sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
    androidVersion: '14',
    deviceModel: 'Pixel 7',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(32).toString('hex'),
    hmac: 'not-a-valid-hex-format', // Invalid
  };

  console.log('Sending request with invalid HMAC format...');
  try {
    const response = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('HTTP Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 403) {
      console.log('✓ PASS: Invalid format correctly rejected');
      return true;
    } else {
      console.log('✗ FAIL: Invalid format not handled correctly');
      return false;
    }
  } catch (err) {
    console.error('✗ ERROR:', err.message);
    return false;
  }
}

// Run all tests
(async () => {
  const results = [];
  results.push(await testValidRequest());
  results.push(await testInvalidHmac());
  results.push(await testInvalidFormat());
  
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${results.filter(r => r).length}/${results.length}`);
  console.log('');
})();
