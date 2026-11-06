import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Ensure env variables are loaded even if utility is imported in standalone scripts
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const PREFIX = 'enc:v1:'

/**
 * Get the 32-byte encryption key from environment variable.
 * Fallbacks to a deterministic derived key if ENCRYPTION_KEY is not defined.
 */
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY

  if (envKey) {
    if (envKey.length === 64) {
      // 64 hex characters = 32 bytes
      return Buffer.from(envKey, 'hex')
    }
    // Hash any string to obtain a consistent 32-byte key
    return crypto.createHash('sha256').update(envKey).digest()
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: ENCRYPTION_KEY environment variable is mandatory in production environment.')
  }

  // Fallback default key for local development
  const fallback = 'psd-local-database-encryption-key-2026-secure-vault'
  return crypto.createHash('sha256').update(fallback).digest()
}

const keyBuffer = getEncryptionKey()

/**
 * Generate a deterministic HMAC-SHA256 blind index for fast $O(1)$ searchable encryption
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function createBlindIndex(value) {
  if (!value) return null
  const normalized = String(value).trim().toUpperCase()
  return crypto.createHmac('sha256', keyBuffer).update(normalized).digest('hex')
}

/**
 * Encrypt a single text field with AES-256-GCM
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function encryptField(text) {
  if (text === null || text === undefined || text === '') {
    return text
  }

  const str = String(text)
  // If already encrypted, do not double encrypt
  if (str.startsWith(PREFIX)) {
    return str
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv)

    let encrypted = cipher.update(str, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')

    return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`
  } catch (error) {
    console.error('Field encryption failed:', error.message)
    throw error
  }
}

/**
 * Decrypt a single encrypted text field
 * @param {string|null|undefined} encryptedText
 * @returns {string|null}
 */
export function decryptField(encryptedText) {
  if (encryptedText === null || encryptedText === undefined || encryptedText === '') {
    return encryptedText
  }

  const str = String(encryptedText)
  // If not encrypted, return original string (backwards compatibility for unencrypted legacy rows)
  if (!str.startsWith(PREFIX)) {
    return str
  }

  try {
    const parts = str.slice(PREFIX.length).split(':')
    if (parts.length !== 3) {
      return str
    }

    const [ivHex, tagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(tagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.warn('Field decryption failed or invalid key, preserving stored value:', error.message)
    return str
  }
}

/**
 * Check if a field value is currently encrypted
 * @param {any} val
 * @returns {boolean}
 */
export function isEncrypted(val) {
  return typeof val === 'string' && val.startsWith(PREFIX)
}

// User-sensitive fields in Submission record to encrypt/decrypt
const SENSITIVE_USER_FIELDS = [
  'name',
  'regNo',
  'section',
  'email',
  'principle',
  'assignmentName',
  'reportName',
]

/**
 * Encrypt sensitive user fields in a submission payload before saving to DB
 * @param {Object} data
 * @returns {Object}
 */
export function encryptSubmissionData(data) {
  if (!data || typeof data !== 'object') return data

  const encrypted = { ...data }
  for (const field of SENSITIVE_USER_FIELDS) {
    if (field in encrypted && encrypted[field] !== undefined) {
      encrypted[field] = encryptField(encrypted[field])
    }
  }
  return encrypted
}

/**
 * Decrypt sensitive user fields in a retrieved DB submission record
 * @param {Object} record
 * @returns {Object}
 */
export function decryptSubmissionRecord(record) {
  if (!record || typeof record !== 'object') return record

  const decrypted = { ...record }
  for (const field of SENSITIVE_USER_FIELDS) {
    if (field in decrypted && decrypted[field] !== undefined) {
      decrypted[field] = decryptField(decrypted[field])
    }
  }
  return decrypted
}

/**
 * Decrypt an array of submission records
 * @param {Array<Object>} records
 * @returns {Array<Object>}
 */
export function decryptSubmissionRecords(records) {
  if (!Array.isArray(records)) return records
  return records.map(decryptSubmissionRecord)
}

