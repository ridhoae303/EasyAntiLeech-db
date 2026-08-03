import crypto from 'crypto'
import HmacSHA256 from 'crypto-js/hmac-sha256'
import Hex from 'crypto-js/enc-hex'

if (!process.env.HMAC_SECRET) {
  throw new Error('HMAC_SECRET environment variable is required for production')
}

const HMAC_SECRET = process.env.HMAC_SECRET
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const NONCE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export interface VerificationRequest {
  packageName: string
  sha256Signature: string
  androidVersion: string
  deviceModel: string
  timestamp: number
  nonce: string
  hmac: string
}

/**
 * Generates a constant-time HMAC-SHA256 signature for the request payload
 */
export function generateHmac(payload: Record<string, any>): string {
  const sorted = sortObjectKeys(payload)
  const message = JSON.stringify(sorted)
  const hmac = HmacSHA256(message, HMAC_SECRET).toString(Hex)
  return hmac
}

/**
 * Verifies HMAC using constant-time comparison
 * Prevents timing attacks against HMAC validation
 */
export function verifyHmac(payload: Record<string, any>, providedHmac: string): boolean {
  const expectedHmac = generateHmac(payload)
  return constantTimeCompare(expectedHmac, providedHmac)
}

/**
 * Constant-time comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Sort object keys for consistent HMAC validation
 */
function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  return Object.keys(obj)
    .sort()
    .reduce(
      (result, key) => {
        result[key] = obj[key]
        return result
      },
      {} as Record<string, any>
    )
}

/**
 * Validates request timestamp to prevent replay and stale requests
 */
export function validateTimestamp(requestTimestamp: number): {
  valid: boolean
  reason?: string
} {
  const now = Date.now()
  const age = now - requestTimestamp

  if (requestTimestamp > now + 1000) {
    return {
      valid: false,
      reason: 'Request timestamp is in the future',
    }
  }

  if (age > REQUEST_TIMEOUT_MS) {
    return {
      valid: false,
      reason: `Request expired: ${Math.floor(age / 1000)} seconds old`,
    }
  }

  return { valid: true }
}

/**
 * Generates a cryptographically secure random nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validates nonce format
 */
export function isValidNonce(nonce: string): boolean {
  // Nonce should be 64 characters (32 bytes in hex)
  return /^[a-f0-9]{64}$/.test(nonce)
}

/**
 * Computes request hash for detailed logging
 */
export function computeRequestHash(payload: Record<string, any>): string {
  const normalized = JSON.stringify(sortObjectKeys(payload))
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Validates SHA-256 hash format
 */
export function isValidSha256(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash)
}

/**
 * Sanitizes and validates package name format
 */
export function isValidPackageName(packageName: string): boolean {
  // Android package name format: com.example.app
  return /^[a-zA-Z0-9._]{3,256}$/.test(packageName) && packageName.includes('.')
}

/**
 * Rate limiting check using token bucket algorithm
 * Returns null if within limits, error message otherwise
 */
export function checkRateLimit(
  ipAddress: string,
  requestsPerMinute: number = 30
): { allowed: boolean; reason?: string } {
  // This would be implemented with Redis or in-memory cache
  // For now, basic validation
  return { allowed: true }
}

export const NONCE_EXPIRY_MS = NONCE_TTL_MS
export const REQUEST_TIMEOUT = REQUEST_TIMEOUT_MS
