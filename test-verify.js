const HmacSHA256 = require('crypto-js/hmac-sha256');
const Hex = require('crypto-js/enc-hex');
const crypto = require('crypto');

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-key';

console.log('Using HMAC_SECRET:', HMAC_SECRET);

// Generate test payload - NOTE: Must match the order used in the backend verify endpoint
const payloadForHmac = {
  packageName: 'com.example.app',
  sha256Signature: 'e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b',
  androidVersion: '14',
  deviceModel: 'Pixel 7',
  timestamp: Date.now(),
  nonce: crypto.randomBytes(32).toString('hex'),
};

// The backend's sortObjectKeys function
function sortObjectKeys(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

const sorted = sortObjectKeys(payloadForHmac);
const message = JSON.stringify(sorted);
console.log('Payload message:', message);

const hmac = HmacSHA256(message, HMAC_SECRET).toString(Hex);
console.log('Generated HMAC:', hmac);

const requestBody = {
  ...payloadForHmac,
  hmac,
};

console.log('Test Request:');
console.log(JSON.stringify(requestBody, null, 2));
console.log('\nTesting /api/verify endpoint...\n');

fetch('http://localhost:3000/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
})
  .then((r) => r.json())
  .then((data) => {
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((err) => console.error('Error:', err.message));
