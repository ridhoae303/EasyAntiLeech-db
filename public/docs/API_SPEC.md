# Android Anti-Leech Backend API Specification

## Overview

Production-ready secure backend for Android app verification with certificate pinning, replay protection, and comprehensive logging.

**Base URL:** `https://your-domain.vercel.app`
**Protocol:** HTTPS only
**Content-Type:** `application/json`

---

## Security Features

### 1. HMAC-SHA256 Authentication
- All requests require HMAC signature
- Secret key stored only on backend (never exposed to client)
- Constant-time comparison prevents timing attacks

### 2. Nonce Validation
- Prevents replay attacks
- Each nonce can only be used once
- Nonce TTL: 10 minutes

### 3. Timestamp Validation
- Rejects requests older than 5 minutes
- Prevents stale request acceptance
- Timestamp must be within ±1 second of server time

### 4. Certificate Signature Verification
- Validates SHA-256 signing certificate hash
- Only approved signatures are accepted
- Hardcoded allowlist in database

### 5. Rate Limiting
- Per-IP request limits
- Prevents brute force attacks
- Default: 30 requests per minute

---

## Endpoints

### POST /api/verify

**Purpose:** Verify Android app authenticity

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "packageName": "com.example.app",
  "sha256Signature": "e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b",
  "androidVersion": "14",
  "deviceModel": "Pixel 6 Pro",
  "timestamp": 1692345600000,
  "nonce": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f",
  "hmac": "calculated_hmac_value"
}
```

**Request Field Descriptions:**

| Field | Type | Description | Validation |
|-------|------|-------------|-----------|
| `packageName` | string | Android app package name | Format: `com.domain.app` (3-256 chars, alphanumeric with dots) |
| `sha256Signature` | string | SHA-256 signing certificate hash | 64 hex characters |
| `androidVersion` | string | Device Android version | Any non-empty string (e.g., "14", "13") |
| `deviceModel` | string | Device model name | Any non-empty string (e.g., "Pixel 6 Pro") |
| `timestamp` | number | Request timestamp in milliseconds | Unix timestamp, must be within 5 minutes of server time |
| `nonce` | string | Random cryptographic nonce | 64 hex characters, can only be used once |
| `hmac` | string | HMAC-SHA256 of request payload | 64 hex characters |

**HMAC Calculation:**

1. Create payload object with fields sorted alphabetically:
```json
{
  "androidVersion": "14",
  "deviceModel": "Pixel 6 Pro",
  "nonce": "...",
  "packageName": "com.example.app",
  "sha256Signature": "...",
  "timestamp": 1692345600000
}
```

2. Convert to JSON string (no extra whitespace)
3. Compute HMAC-SHA256 using backend secret
4. Output as hexadecimal string

**Success Response (200):**
```json
{
  "status": "allowed",
  "timestamp": 1692345600000
}
```

**Rejection Response (403):**
```json
{
  "status": "rejected",
  "reason": "Certificate signature not in approved list",
  "timestamp": 1692345600000
}
```

**Error Response (500):**
```json
{
  "status": "rejected",
  "reason": "Internal server error",
  "timestamp": 1692345600000
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Verification successful, app is authentic |
| 403 | Verification failed, app rejected |
| 400 | Invalid request format or malformed JSON |
| 429 | Too many requests (rate limited) |
| 500 | Server error |

---

### GET /api/health

**Purpose:** Health check endpoint for monitoring

**Request:** None

**Response (200):**
```json
{
  "status": "healthy",
  "database": "connected",
  "allowedSignaturesCount": 4,
  "timestamp": "2024-01-15T10:30:45.123Z",
  "version": "1.0.0"
}
```

**Response (503 - Unhealthy):**
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "allowedSignaturesCount": 0,
  "timestamp": "2024-01-15T10:30:45.123Z",
  "version": "1.0.0"
}
```

---

### GET /api/logs

**Purpose:** Retrieve verification event logs (admin only)

**Authentication:** Bearer token required
```
Authorization: Bearer {ADMIN_API_TOKEN}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Results per page (max 1000, default 100) |
| `offset` | number | Pagination offset (default 0) |
| `status` | string | Filter by status: `ACCEPTED`, `REJECTED`, `HMAC_MISMATCH`, etc. |
| `packageName` | string | Filter by package name |
| `startDate` | ISO 8601 | Filter events after this date |
| `endDate` | ISO 8601 | Filter events before this date |

**Request Examples:**
```
GET /api/logs?limit=50&offset=0
GET /api/logs?status=REJECTED&packageName=com.example.app
GET /api/logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

**Response (200):**
```json
{
  "logs": [
    {
      "id": 12345,
      "timestamp": "2024-01-15T10:30:45.123Z",
      "packageName": "com.example.app",
      "sha256Signature": "e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b",
      "androidVersion": "14",
      "deviceModel": "Pixel 6 Pro",
      "ipAddress": "192.0.2.1",
      "requestStatus": "ACCEPTED",
      "rejectionReason": null,
      "nonce": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f",
      "requestHash": "sha256_hash_of_request"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## Request Status Codes

| Status | Description |
|--------|-------------|
| `ACCEPTED` | Request verified successfully |
| `REJECTED` | Generic rejection |
| `PARSE_ERROR` | Invalid JSON |
| `VALIDATION_ERROR` | Missing/invalid fields |
| `HMAC_MISMATCH` | HMAC signature invalid |
| `TIMESTAMP_INVALID` | Timestamp too old/new |
| `REPLAY_ATTACK` | Nonce already used |
| `SIGNATURE_NOT_ALLOWED` | Certificate not in allowlist |

---

## Rejection Reasons

| Reason | Cause |
|--------|-------|
| Invalid JSON payload | Malformed JSON in request body |
| packageName must be a string | Wrong type for field |
| Invalid packageName format | Invalid Android package name |
| Invalid sha256Signature format | Wrong format for hash |
| Invalid nonce format | Nonce not 64 hex characters |
| Invalid hmac format | HMAC not 64 hex characters |
| Request timestamp is in the future | Clock skew issue |
| Request expired | Timestamp older than 5 minutes |
| HMAC verification failed | Wrong secret/payload mismatch |
| Nonce already used (replay attack detected) | Duplicate nonce |
| Certificate signature not in approved list | Unknown app signature |
| Internal server error | Server error |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `HMAC_SECRET` | Yes | Secret key for HMAC signing (≥32 bytes) |
| `ADMIN_API_TOKEN` | Yes | Bearer token for admin logs endpoint |

**Generation:**
```bash
# Generate HMAC secret
openssl rand -base64 32

# Generate admin token
openssl rand -hex 32
```

---

## Database Schema

### allowed_signatures
Stores approved Android app signing certificates

```sql
CREATE TABLE allowed_signatures (
  id BIGSERIAL PRIMARY KEY,
  sha256_hash TEXT NOT NULL UNIQUE,
  package_name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);
```

### leech_events
Logs all verification requests (accepted and rejected)

```sql
CREATE TABLE leech_events (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  package_name TEXT NOT NULL,
  sha256_signature TEXT NOT NULL,
  android_version TEXT,
  device_model TEXT,
  ip_address INET,
  request_status TEXT NOT NULL,
  rejection_reason TEXT,
  nonce TEXT NOT NULL,
  request_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### nonce_cache
Prevents replay attacks by tracking used nonces

```sql
CREATE TABLE nonce_cache (
  id BIGSERIAL PRIMARY KEY,
  nonce TEXT NOT NULL UNIQUE,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET
);
```

---

## Security Best Practices

### For Android App Implementation

1. **Certificate Pinning**
   - Pin the backend certificate at build time
   - Reject self-signed or invalid certificates
   - Implement certificate validation before HMAC

2. **Generate Fresh Nonce**
   - Create new cryptographic random nonce for each request
   - Never reuse nonce values
   - Use 32 bytes of entropy (64 hex chars)

3. **Timestamp Synchronization**
   - Sync device time with NTP
   - Account for minor clock skew (±1 second)
   - Use system time, not relative time

4. **HMAC Calculation**
   - Sort payload keys alphabetically
   - Use exact field values from verification
   - Never modify payload after HMAC calculation

5. **Request Verification**
   - Perform local signature verification first
   - Only communicate if local check passes
   - Handle backend rejection gracefully

### For Backend Operation

1. **Secret Management**
   - Store HMAC secret in environment variables
   - Rotate secrets quarterly
   - Never log or expose secret values

2. **Monitoring**
   - Alert on repeated rejections from same IP
   - Monitor for replay attack patterns
   - Track timestamp validation failures

3. **Logging**
   - Log all requests (accepted and rejected)
   - Include IP address for rate limiting
   - Preserve rejection reasons for debugging

4. **Rate Limiting**
   - Enforce per-IP limits
   - Block IPs with excessive rejections
   - Use distributed rate limiting for multi-region

5. **Database**
   - Enable SSL for database connections
   - Use connection pooling
   - Regular backup of leech_events table

---

## Example: Android Request Flow

```
1. App computes SHA-256 of signing certificate
   ↓
2. Local signature verification passes
   ↓
3. Generate random nonce (64 hex chars)
   ↓
4. Get current timestamp (milliseconds)
   ↓
5. Create payload with all fields
   ↓
6. Sort fields alphabetically
   ↓
7. Calculate HMAC-SHA256 of payload
   ↓
8. Send HTTPS POST to /api/verify
   ↓
9. Backend validates HMAC first
   ↓
10. Backend validates timestamp
    ↓
11. Backend checks nonce uniqueness
    ↓
12. Backend verifies signature in allowlist
    ↓
13. Return 200 OK if all checks pass
    ↓
14. App continues running
    ↓
15. Local anti-tamper logic responsible for termination
```

---

## Deployment

### Vercel Environment Variables

Set these in your Vercel project settings:

```
DATABASE_URL=postgresql://user:pass@host/db
HMAC_SECRET=<generated_secret>
ADMIN_API_TOKEN=<generated_token>
```

### Certificate Pinning URL

Configure in Android app:
```
https://your-domain.vercel.app/api/verify
```

### Health Check URL

For monitoring and load balancing:
```
https://your-domain.vercel.app/api/health
```

---

## Troubleshooting

### HMAC Mismatch
- Verify payload fields match exactly
- Ensure alphabetical sort of keys
- Check secret matches between app and backend
- Use constant-time comparison

### Nonce Already Used
- Generate fresh nonce for each request
- Don't cache or reuse nonces
- Wait for TTL expiration (10 minutes)

### Timestamp Invalid
- Sync device time with NTP
- Check timezone handling
- Ensure millisecond precision

### Rate Limited
- Reduce request frequency
- Contact admin for limit increase
- Wait before retry

### Database Connection
- Verify DATABASE_URL format
- Check SSL requirements
- Confirm firewall rules
