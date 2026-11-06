import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const AUTH_SECRET = process.env.AUTH_SECRET || 'psd-default-auth-secret-fallback-key-2026'

/**
 * Timing-safe string comparison via SHA-256 digest comparison
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const hashA = crypto.createHash('sha256').update(a).digest()
  const hashB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

/**
 * Validate admin username & password against environment credentials
 */
export function verifyAdminCredentials(username, password) {
  const expectedId = (process.env.ADMIN_ID || 'admin').trim().toLowerCase()
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123'

  if (!username || !password) return false

  const idMatch = safeCompare(String(username).trim().toLowerCase(), expectedId)
  const passMatch = safeCompare(String(password), expectedPassword)

  return idMatch && passMatch
}

/**
 * Generate a cryptographically signed Bearer token (valid for 24 hours)
 */
export function generateAdminToken(extra = {}) {
  const payload = {
    sub: 'admin',
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    ...extra,
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url')

  return `${payloadB64}.${signature}`
}

/**
 * Verify HMAC signature and expiration of Bearer token
 */
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing' }
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token structure' }
  }

  const [payloadB64, signature] = parts

  // 1. Verify cryptographic signature
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url')

  const sigValid = safeCompare(signature, expectedSignature)
  if (!sigValid) {
    return { valid: false, error: 'Invalid token signature' }
  }

  // 2. Decode payload & check expiration
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Token has expired' }
    }
    return { valid: true, payload }
  } catch {
    return { valid: false, error: 'Corrupt token payload' }
  }
}

