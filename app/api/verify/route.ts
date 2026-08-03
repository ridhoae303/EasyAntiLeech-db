import { NextRequest, NextResponse } from 'next/server'
import {
  verifyHmac,
  validateTimestamp,
  isValidNonce,
  isValidSha256,
  isValidPackageName,
  computeRequestHash,
} from '@/lib/security'
import { eq, and, gt } from 'drizzle-orm'

interface VerifyRequestBody {
  packageName: string
  sha256Signature: string
  androidVersion: string
  deviceModel: string
  timestamp: number
  nonce: string
  hmac: string
}

interface ApiResponse {
  status: 'allowed' | 'rejected'
  reason?: string
  requestId?: string
  timestamp: number
}

/**
 * Main verification endpoint for Android app security
 * Validates certificate signature, timestamp, and nonce before allowing app to proceed
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const clientIp = getClientIp(request)
  const requestTimestamp = Date.now()

  // Lazy-load database to avoid build-time errors
  let db: any
  let allowedSignatures: any
  let leechEvents: any
  let nonceCache: any

  try {
    const dbModule = await import('@/lib/db')
    const schemaModule = await import('@/lib/schema')
    db = dbModule.db
    allowedSignatures = schemaModule.allowedSignatures
    leechEvents = schemaModule.leechEvents
    nonceCache = schemaModule.nonceCache
  } catch (error) {
    console.error('[Security API] Database import error:', error)
    return NextResponse.json(
      {
        status: 'rejected',
        reason: 'Service unavailable',
        timestamp: requestTimestamp,
      },
      { status: 503 }
    )
  }

  try {
    // Parse JSON body
    let body: VerifyRequestBody
    try {
      body = await request.json()
    } catch {
      return logAndRejectRequest(
        'PARSE_ERROR',
        'Invalid JSON payload',
        clientIp,
        requestTimestamp,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        db,
        leechEvents
      )
    }

    // Validate required fields
    const validation = validateRequestBody(body)
    if (!validation.valid) {
      return logAndRejectRequest(
        'VALIDATION_ERROR',
        validation.reason!,
        clientIp,
        requestTimestamp,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        db,
        leechEvents
      )
    }

    // Validate HMAC (before timestamp to prevent info leakage)
    const payloadForHmac = {
      packageName: body.packageName,
      sha256Signature: body.sha256Signature,
      androidVersion: body.androidVersion,
      deviceModel: body.deviceModel,
      timestamp: body.timestamp,
      nonce: body.nonce,
    }

    if (!verifyHmac(payloadForHmac, body.hmac)) {
      return logAndRejectRequest(
        'HMAC_MISMATCH',
        'HMAC verification failed',
        clientIp,
        requestTimestamp,
        body.packageName,
        body.sha256Signature,
        body.androidVersion,
        body.deviceModel,
        body.nonce,
        db,
        leechEvents
      )
    }

    // Validate timestamp
    const timestampValidation = validateTimestamp(body.timestamp)
    if (!timestampValidation.valid) {
      return logAndRejectRequest(
        'TIMESTAMP_INVALID',
        timestampValidation.reason!,
        clientIp,
        requestTimestamp,
        body.packageName,
        body.sha256Signature,
        body.androidVersion,
        body.deviceModel,
        body.nonce,
        db,
        leechEvents
      )
    }

    // Check for replay attack using nonce
    const nonceValid = await validateAndConsumeNonce(body.nonce, clientIp, db, nonceCache)
    if (!nonceValid.valid) {
      return logAndRejectRequest(
        'REPLAY_ATTACK',
        nonceValid.reason!,
        clientIp,
        requestTimestamp,
        body.packageName,
        body.sha256Signature,
        body.androidVersion,
        body.deviceModel,
        body.nonce,
        db,
        leechEvents
      )
    }

    // Verify signature exists in allowed list
    const signatureExists = await verifySignature(body.sha256Signature, db, allowedSignatures)
    if (!signatureExists) {
      return logAndRejectRequest(
        'SIGNATURE_NOT_ALLOWED',
        'Certificate signature not in approved list',
        clientIp,
        requestTimestamp,
        body.packageName,
        body.sha256Signature,
        body.androidVersion,
        body.deviceModel,
        body.nonce,
        db,
        leechEvents
      )
    }

    // All validations passed
    const requestHash = computeRequestHash(payloadForHmac)
    await logEvent('ACCEPTED', null, clientIp, body, requestHash)

    return NextResponse.json(
      {
        status: 'allowed' as const,
        timestamp: requestTimestamp,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Security API] Unexpected error:', error)
    return NextResponse.json(
      {
        status: 'rejected',
        reason: 'Internal server error',
        timestamp: requestTimestamp,
      },
      { status: 500 }
    )
  }
}

/**
 * Validates request body structure and types
 */
function validateRequestBody(body: unknown): {
  valid: boolean
  reason?: string
} {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, reason: 'Request body must be a JSON object' }
  }

  const req = body as Record<string, unknown>

  if (typeof req.packageName !== 'string') {
    return { valid: false, reason: 'packageName must be a string' }
  }

  if (typeof req.sha256Signature !== 'string') {
    return { valid: false, reason: 'sha256Signature must be a string' }
  }

  if (typeof req.androidVersion !== 'string') {
    return { valid: false, reason: 'androidVersion must be a string' }
  }

  if (typeof req.deviceModel !== 'string') {
    return { valid: false, reason: 'deviceModel must be a string' }
  }

  if (typeof req.timestamp !== 'number' || !Number.isInteger(req.timestamp)) {
    return { valid: false, reason: 'timestamp must be an integer' }
  }

  if (typeof req.nonce !== 'string') {
    return { valid: false, reason: 'nonce must be a string' }
  }

  if (typeof req.hmac !== 'string') {
    return { valid: false, reason: 'hmac must be a string' }
  }

  // Validate formats
  if (!isValidPackageName(req.packageName)) {
    return { valid: false, reason: 'Invalid packageName format' }
  }

  if (!isValidSha256(req.sha256Signature)) {
    return { valid: false, reason: 'Invalid sha256Signature format' }
  }

  if (!isValidNonce(req.nonce)) {
    return { valid: false, reason: 'Invalid nonce format' }
  }

  if (!/^[a-f0-9]{64}$/.test(req.hmac)) {
    return { valid: false, reason: 'Invalid hmac format' }
  }

  return { valid: true }
}

/**
 * Validates nonce and prevents replay attacks
 * Each nonce can only be used once
 */
async function validateAndConsumeNonce(
  nonce: string,
  ipAddress: string,
  db: any,
  nonceCacheTable: any
): Promise<{
  valid: boolean
  reason?: string
}> {
  try {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000) // 10 minute TTL

    // Check if nonce already exists (replay attack)
    const existing = await db
      .select()
      .from(nonceCacheTable)
      .where(eq(nonceCacheTable.nonce, nonce))
      .limit(1)

    if (existing.length > 0) {
      return {
        valid: false,
        reason: 'Nonce already used (replay attack detected)',
      }
    }

    // Insert nonce to mark as used
    await db.insert(nonceCacheTable).values({
      nonce,
      usedAt: now,
      expiresAt,
      ipAddress: ipAddress as any, // Cast for INET type
    })

    return { valid: true }
  } catch (error) {
    console.error('[Security API] Nonce validation error:', error)
    return {
      valid: false,
      reason: 'Nonce validation failed',
    }
  }
}

/**
 * Verifies that the provided signature is in the allowed list
 */
async function verifySignature(sha256Signature: string, db: any, allowedSignaturesTable: any): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(allowedSignaturesTable)
      .where(
        and(
          eq(allowedSignaturesTable.sha256Hash, sha256Signature),
          eq(allowedSignaturesTable.isActive, true)
        )
      )
      .limit(1)

    return result.length > 0
  } catch (error) {
    console.error('[Security API] Signature verification error:', error)
    return false
  }
}

/**
 * Logs verification event to database
 */
async function logEvent(
  status: string,
  rejectionReason: string | null,
  ipAddress: string,
  body: VerifyRequestBody,
  requestHash: string
): Promise<void> {
  try {
    await db.insert(leechEvents).values({
      timestamp: new Date(body.timestamp),
      packageName: body.packageName,
      sha256Signature: body.sha256Signature,
      androidVersion: body.androidVersion,
      deviceModel: body.deviceModel,
      ipAddress: ipAddress as any, // Cast for INET type
      requestStatus: status,
      rejectionReason,
      nonce: body.nonce,
      requestHash,
    })
  } catch (error) {
    console.error('[Security API] Event logging error:', error)
    // Don't throw - logging failure shouldn't block the response
  }
}

/**
 * Helper to log rejection and return response
 */
async function logAndRejectRequest(
  status: string,
  reason: string,
  ipAddress: string,
  requestTimestamp: number,
  packageName?: string,
  sha256Signature?: string,
  androidVersion?: string,
  deviceModel?: string,
  nonce?: string,
  db?: any,
  leechEventsTable?: any
): Promise<NextResponse<ApiResponse>> {
  // Try to log, but don't block response
  if (packageName && sha256Signature && nonce && db && leechEventsTable) {
    try {
      const requestHash = computeRequestHash({
        packageName,
        sha256Signature,
        androidVersion: androidVersion || '',
        deviceModel: deviceModel || '',
        timestamp: requestTimestamp,
        nonce,
      })

      await db.insert(leechEventsTable).values({
        timestamp: new Date(),
        packageName,
        sha256Signature,
        androidVersion: androidVersion || null,
        deviceModel: deviceModel || null,
        ipAddress: ipAddress as any,
        requestStatus: status,
        rejectionReason: reason,
        nonce,
        requestHash,
      })
    } catch (error) {
      console.error('[Security API] Failed to log rejection:', error)
    }
  }

  return NextResponse.json(
    {
      status: 'rejected' as const,
      reason,
      timestamp: requestTimestamp,
    },
    { status: 403 }
  )
}

/**
 * Extracts client IP address from request headers
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return request.ip || '0.0.0.0'
}

// Cleanup expired nonces periodically
export async function DELETE(): Promise<NextResponse> {
  try {
    const now = new Date()
    await db
      .delete(nonceCache)
      .where(gt(nonceCache.expiresAt, now))
  } catch (error) {
    console.error('[Security API] Nonce cleanup error:', error)
  }

  return NextResponse.json({ status: 'cleanup_scheduled' })
}
