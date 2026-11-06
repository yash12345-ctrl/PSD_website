import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure upload destination directories exist
const uploadBaseDir = path.resolve(__dirname, '../../uploads')
const assignmentsDir = path.join(uploadBaseDir, 'assignments')
const reportsDir = path.join(uploadBaseDir, 'reports')

;[assignmentsDir, reportsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Configure Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'assignment') {
      cb(null, assignmentsDir)
    } else if (file.fieldname === 'report' || file.fieldname === 'poster') {
      cb(null, reportsDir)
    } else {
      cb(null, uploadBaseDir)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  },
})

// File filter for strict deliverable extensions
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()

  if (file.fieldname === 'assignment') {
    const allowed = ['.pdf', '.doc', '.docx']
    if (allowed.includes(ext)) {
      return cb(null, true)
    }
    return cb(
      new Error(`Invalid assignment format (${ext}). Assignment strictly only accepts PDF, DOC, or DOCX documents.`),
      false
    )
  }

  if (file.fieldname === 'poster' || file.fieldname === 'report') {
    const allowed = ['.pdf', '.png']
    if (allowed.includes(ext)) {
      return cb(null, true)
    }
    return cb(
      new Error(`Invalid poster format (${ext}). Poster strictly only accepts PDF or PNG files.`),
      false
    )
  }

  return cb(new Error(`Unknown upload field: ${file.fieldname}`), false)
}

// 50 MB max file limit per file
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
})

// Middleware accepting 'assignment' and 'report' (or 'poster')
export const uploadSubmissionFiles = upload.fields([
  { name: 'assignment', maxCount: 1 },
  { name: 'report', maxCount: 1 },
  { name: 'poster', maxCount: 1 },
])

/**
 * Verifies that the file content bytes match the claimed extension.
 * PDF: %PDF- (0x25 0x50 0x44 0x46)
 * PNG: \x89PNG (0x89 0x50 0x4E 0x47)
 * DOCX: PK\x03\x04 (0x50 0x4B 0x03 0x04)
 * DOC: \xD0\xCF\x11\xE0 (0xD0 0xCF 0x11 0xE0)
 */
export function verifyFileSignature(filePath, originalname) {
  try {
    const ext = path.extname(originalname || filePath).toLowerCase()
    const buffer = Buffer.alloc(8)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buffer, 0, 8, 0)
    fs.closeSync(fd)

    if (ext === '.pdf') {
      return buffer.slice(0, 4).toString('ascii') === '%PDF'
    }
    if (ext === '.png') {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    }
    if (ext === '.docx') {
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
    }
    if (ext === '.doc') {
      return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0
    }
    return false
  } catch {
    return false
  }
}

export { uploadBaseDir }
