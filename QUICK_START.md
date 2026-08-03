# Quick Start Guide

## 5-Minute Setup

### 1. Environment Setup
```bash
# Generate secrets
HMAC_SECRET=$(openssl rand -base64 32)
ADMIN_API_TOKEN=$(openssl rand -hex 32)

# Save to .env.local
cp .env.example .env.local
# Edit .env.local with:
# - DATABASE_URL (from Neon)
# - HMAC_SECRET (generated above)
# - ADMIN_API_TOKEN (generated above)
```

### 2. Local Testing
```bash
pnpm install
pnpm dev

# Test endpoints
curl http://localhost:3000/api/health
```

### 3. Deploy to Vercel
```bash
# Option 1: Using GitHub
git push origin main
# Then in Vercel Console, import your repo

# Option 2: Using Vercel CLI
pnpm i -g vercel
vercel

# Add environment variables in Console
# Then redeploy
```

### 4. Verify Deployment
```bash
curl https://your-project.vercel.app/api/health
```

---

## Endpoint Quick Reference

### 1. Verify App (POST /api/verify)
```bash
curl -X POST https://your-domain/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "packageName": "com.example.app",
    "sha256Signature": "e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b",
    "androidVersion": "14",
    "deviceModel": "Pixel 6",
    "timestamp": '$(($(date +%s)*1000))',
    "nonce": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f",
    "hmac": "calculated_hmac"
  }'
```

**Response (Allowed):**
```json
{
  "status": "allowed",
  "timestamp": 1692345600000
}
```

**Response (Rejected):**
```json
{
  "status": "rejected",
  "reason": "Certificate signature not in approved list",
  "timestamp": 1692345600000
}
```

### 2. Health Check (GET /api/health)
```bash
curl https://your-domain/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "allowedSignaturesCount": 4,
  "timestamp": "2024-01-15T10:30:45.123Z",
  "version": "1.0.0"
}
```

### 3. View Logs (GET /api/logs)
```bash
# Get last 100 events
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain/api/logs?limit=100"

# Filter by status
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain/api/logs?status=REJECTED&limit=50"

# Filter by package name
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain/api/logs?packageName=com.example.app"

# Date range filter
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain/api/logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z"
```

---

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host/db
HMAC_SECRET=$(openssl rand -base64 32)
ADMIN_API_TOKEN=$(openssl rand -hex 32)
```

---

## Android Implementation

### 1. Add Certificate Pinning
```kotlin
val certificatePinner = CertificatePinner.Builder()
    .add("your-domain.vercel.app", "sha256/YOUR_CERT_HASH")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

### 2. Calculate HMAC
```kotlin
val payload = mapOf(
    "packageName" to packageName,
    "sha256Signature" to signature,
    "androidVersion" to Build.VERSION.RELEASE,
    "deviceModel" to Build.MODEL,
    "timestamp" to System.currentTimeMillis(),
    "nonce" to generateNonce()
)

val hmac = calculateHmac(payload)
```

### 3. Send Verification Request
```kotlin
val request = VerificationRequest(
    packageName = payload["packageName"] as String,
    sha256Signature = payload["sha256Signature"] as String,
    androidVersion = payload["androidVersion"] as String,
    deviceModel = payload["deviceModel"] as String,
    timestamp = payload["timestamp"] as Long,
    nonce = payload["nonce"] as String,
    hmac = hmac
)

val response = verificationService.verify(request)
if (response.status == "allowed") {
    // App verified, proceed
} else {
    // App rejected, handle error
}
```

---

## Troubleshooting

### Issue: Database Connection Error
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Should start with: postgresql://
# Should include host, user, password, database
```

### Issue: HMAC Verification Fails
```bash
# Ensure payload fields match exactly
# Check alphabetical sort of keys
# Verify secret matches between app and backend
```

### Issue: Nonce Already Used
```bash
# Generate fresh nonce for each request
# Nonce TTL: 10 minutes
# Can't reuse same nonce within TTL
```

### Issue: Timestamp Invalid
```bash
# Device time must be synchronized with NTP
# Requests older than 5 minutes rejected
# Future timestamps also rejected (>1 second)
```

---

## Database

### Add New Signature
```sql
INSERT INTO allowed_signatures (sha256_hash, is_active)
VALUES ('new_signature_hash', true);
```

### View Recent Events
```sql
SELECT * FROM leech_events
ORDER BY created_at DESC
LIMIT 100;
```

### Clean Old Nonces
```sql
DELETE FROM nonce_cache
WHERE expires_at < NOW();
```

---

## Pre-populated Signatures

Four test signatures already in database:
- `e4201e2e32724c1ba1ef1100d35ff9f75c5d3e888a58c68b7747808f4c87607b`
- `1e880257852a0a8502d6234797b27f487773a30531a3c132c9e88415ea13da83`
- `a3a97be7f77af2ab1c2226d7aeb6767e840dfb8a4fd53f6fda712e5d6bcbe224`
- `466f3058649060cf07820b4d2b7ef1a0b05b0320fbb980128631f1b4f08f33dd`

Use these for testing Android apps.

---

## Security Checklist

- [ ] HMAC_SECRET generated and stored securely
- [ ] ADMIN_API_TOKEN generated and stored securely
- [ ] DATABASE_URL configured in Vercel
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Certificate pinning implemented in Android app
- [ ] Nonce generated fresh for each request
- [ ] Timestamp synchronized with NTP
- [ ] Local anti-tamper logic implemented
- [ ] Health endpoint accessible and returning healthy
- [ ] Logs endpoint requires authentication
- [ ] No secrets committed to git
- [ ] Test verification request successful

---

## Monitoring

### Check Backend Status
```bash
curl https://your-domain/api/health

# Look for:
# - status: "healthy"
# - database: "connected"
# - allowedSignaturesCount: 4
```

### Monitor Rejections
```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain/api/logs?status=REJECTED" \
  | jq '.logs | length'
```

### Check Error Rate
```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain/api/logs?limit=1000" \
  | jq '.logs[] | select(.requestStatus != "ACCEPTED") | .rejectionReason' \
  | sort | uniq -c
```

---

## Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| API Response | <50ms | 10-30ms |
| Cold Start | <500ms | 400ms |
| DB Query | <5ms | 2-4ms |
| Nonce Lookup | <2ms | 1ms |

---

## File Structure

```
app/
├── layout.tsx           # Root layout
├── page.tsx             # Landing page
└── api/
    ├── verify/          # Main endpoint
    ├── health/          # Status check
    └── logs/            # Admin logs

lib/
├── db.ts                # Database
├── schema.ts            # Tables
└── security.ts          # Utils

docs/
├── README.md            # Overview
├── API_SPEC.md          # Details
├── DEPLOYMENT.md        # Production
├── ANDROID_INTEGRATION.md # Client code
└── QUICK_START.md       # This file
```

---

## Next Steps

1. **Deploy** - Follow 5-minute setup above
2. **Test** - Use curl examples to verify endpoints
3. **Integrate** - Add certificate pinning to Android app
4. **Monitor** - Check health endpoint periodically
5. **Scale** - Optimize database queries as needed

---

## Support

- 📖 Full docs: [README.md](README.md)
- 🔧 API docs: [API_SPEC.md](API_SPEC.md)
- 🚀 Deploy guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- 📱 Android: [ANDROID_INTEGRATION.md](ANDROID_INTEGRATION.md)

---

**Ready to deploy? Start with step 1 above!**
