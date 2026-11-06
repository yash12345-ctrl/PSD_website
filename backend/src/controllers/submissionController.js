import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import prisma from '../config/prisma.js'
import {
  encryptSubmissionData,
  decryptSubmissionRecord,
  decryptSubmissionRecords,
  decryptField,
} from '../utils/encryption.js'
import { verifyFileSignature, uploadBaseDir } from '../config/upload.js'

/**
 * Safely delete unreferenced or failed upload files from disk
 */
function cleanupFiles(files) {
  if (!files) return
  const fileList = Array.isArray(files) ? files : Object.values(files).flat()
  for (const f of fileList) {
    if (f && f.path && fs.existsSync(f.path)) {
      try {
        fs.unlinkSync(f.path)
      } catch (err) {
        console.error('Failed to unlink file during rollback:', err.message)
      }
    }
  }
}

/**
 * Controller: Create new student submission with AES-256-GCM encryption & strict file verification
 * POST /api/submissions
 */
export const createSubmission = async (req, res, next) => {
  try {
    const { name, regNo, section, email, principle, originalWork } = req.body

    // 1. Strict input validation and length limits
    if (!name?.trim() || !regNo?.trim()) {
      cleanupFiles(req.files)
      return res.status(400).json({
        success: false,
        message: 'Name and Roll / Registration Number are required.',
      })
    }

    const trimmedName = name.trim()
    const cleanReg = regNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const trimmedSection = section ? section.trim().toUpperCase() : null
    const trimmedEmail = email ? email.trim() : null
    const trimmedPrinciple = principle ? principle.trim() : null

    if (trimmedName.length > 100) {
      cleanupFiles(req.files)
      return res.status(400).json({ success: false, message: 'Name must not exceed 100 characters.' })
    }
    if (cleanReg.length > 30) {
      cleanupFiles(req.files)
      return res.status(400).json({ success: false, message: 'Registration number must not exceed 30 characters.' })
    }
    if (trimmedSection && trimmedSection.length > 10) {
      cleanupFiles(req.files)
      return res.status(400).json({ success: false, message: 'Section must not exceed 10 characters.' })
    }
    if (trimmedEmail) {
      if (trimmedEmail.length > 120) {
        cleanupFiles(req.files)
        return res.status(400).json({ success: false, message: 'Email must not exceed 120 characters.' })
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        cleanupFiles(req.files)
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' })
      }
    }

    const assignment = req.files?.assignment?.[0]
    // Clean up duplicate poster/report if sent under both fieldnames by older clients
    const poster = req.files?.poster?.[0]
    const report = req.files?.report?.[0]

    let finalReport = poster || report
    if (poster && report && poster.path !== report.path) {
      // Both fields received separate files: keep poster, immediately delete extra report file
      try {
        if (fs.existsSync(report.path)) fs.unlinkSync(report.path)
      } catch (e) {
        console.error('Failed to purge duplicate report file:', e.message)
      }
      finalReport = poster
    }

    // 2. Ensure at least one file was uploaded
    if (!assignment && !finalReport) {
      cleanupFiles(req.files)
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one deliverable (Assignment or Poster/Report).',
      })
    }

    // 3. Strict Magic-Byte Content Verification
    if (assignment) {
      const isValidSig = verifyFileSignature(assignment.path, assignment.originalname)
      if (!isValidSig) {
        cleanupFiles(req.files)
        return res.status(400).json({
          success: false,
          message: 'Assignment file content rejected: File byte signature does not match claimed PDF or DOC/DOCX format.',
        })
      }
    }

    if (finalReport) {
      const isValidSig = verifyFileSignature(finalReport.path, finalReport.originalname)
      if (!isValidSig) {
        cleanupFiles(req.files)
        return res.status(400).json({
          success: false,
          message: 'Poster file content rejected: File byte signature does not match claimed PDF or PNG format.',
        })
      }
    }

    // 4. Generate secure, structured academic reference ID
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase()
    const refId = `PSD-${Date.now().toString(36).toUpperCase()}-${randomHex}`

    // 5. Encrypt sensitive user fields before saving to SQL database
    const encryptedData = encryptSubmissionData({
      refId,
      name: trimmedName,
      regNo: cleanReg,
      section: trimmedSection,
      email: trimmedEmail,
      principle: trimmedPrinciple,
      originalWork: originalWork === 'true' || originalWork === true,
      assignmentPath: assignment ? assignment.path : null,
      assignmentName: assignment ? assignment.originalname : null,
      assignmentSize: assignment ? assignment.size : null,
      reportPath: finalReport ? finalReport.path : null,
      reportName: finalReport ? finalReport.originalname : null,
      reportSize: finalReport ? finalReport.size : null,
    })

    // 6. Save encrypted record to local SQL database via Prisma
    const submission = await prisma.submission.create({
      data: encryptedData,
    })

    invalidateSubmissionsCache()

    const decrypted = decryptSubmissionRecord(submission)

    return res.status(201).json({
      success: true,
      message: 'Submission successfully recorded in database with encryption.',
      data: {
        id: decrypted.id,
        refId: decrypted.refId,
        name: decrypted.name,
        regNo: decrypted.regNo,
        section: decrypted.section,
        email: decrypted.email,
        principle: decrypted.principle,
        originalWork: decrypted.originalWork,
        assignmentName: decrypted.assignmentName,
        reportName: decrypted.reportName,
        createdAt: decrypted.createdAt,
      },
    })
  } catch (error) {
    // Rollback: purge all uploaded files if database write fails
    cleanupFiles(req.files)
    next(error)
  }
}

// In-memory cache for ultra-fast admin dashboard loading (< 1ms response)
let submissionsCache = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 30 * 1000 // 30 seconds

export function invalidateSubmissionsCache() {
  submissionsCache = null
  cacheTimestamp = 0
}

/**
 * Controller: Get all submissions (decrypted for authorized admin dashboard view)
 * GET /api/submissions
 */
export const getAllSubmissions = async (req, res, next) => {
  try {
    const isForce = req.query.force === 'true'
    const now = Date.now()

    if (!isForce && submissionsCache && (now - cacheTimestamp < CACHE_TTL_MS)) {
      return res.status(200).json({
        success: true,
        count: submissionsCache.length,
        data: submissionsCache,
        cached: true,
      })
    }

    const rawSubmissions = await prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        refId: true,
        name: true,
        regNo: true,
        section: true,
        email: true,
        assignmentName: true,
        assignmentSize: true,
        reportName: true,
        reportSize: true,
        createdAt: true,
      },
    })

    const submissions = decryptSubmissionRecords(rawSubmissions)
    submissionsCache = submissions
    cacheTimestamp = now

    return res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Controller: Get submission details by ID or Reference ID
 * GET /api/submissions/:identifier
 */
export const getSubmissionById = async (req, res, next) => {
  try {
    const { identifier } = req.params

    let submission = await prisma.submission.findFirst({
      where: {
        OR: [{ id: identifier }, { refId: identifier }],
      },
    })

    // If identifier is not ID or refId, look up by matching decrypted regNo
    if (!submission) {
      const all = await prisma.submission.findMany({
        select: {
          id: true,
          refId: true,
          regNo: true,
        },
      })
      for (const item of all) {
        const decryptedReg = decryptField(item.regNo)
        if (decryptedReg && decryptedReg.toUpperCase() === identifier.toUpperCase()) {
          submission = await prisma.submission.findUnique({ where: { id: item.id } })
          break
        }
      }
    }

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found.',
      })
    }

    return res.status(200).json({
      success: true,
      data: decryptSubmissionRecord(submission),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Controller: Download an uploaded file
 * GET /api/submissions/:id/download/:fileType
 */
export const downloadSubmissionFile = async (req, res, next) => {
  try {
    const { id, fileType } = req.params

    const rawSubmission = await prisma.submission.findUnique({
      where: { id },
    })

    if (!rawSubmission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' })
    }

    const submission = decryptSubmissionRecord(rawSubmission)

    let filePath = null
    let originalName = null

    if (fileType === 'assignment') {
      filePath = submission.assignmentPath
      originalName = submission.assignmentName
    } else if (fileType === 'report' || fileType === 'poster') {
      filePath = submission.reportPath
      originalName = submission.reportName
    } else {
      return res.status(400).json({ success: false, message: 'Invalid fileType. Must be assignment or poster/report.' })
    }

    if (!filePath) {
      return res.status(404).json({ success: false, message: 'Requested deliverable not attached to this submission.' })
    }

    const resolvedPath = path.resolve(filePath)

    // Defense-in-depth: Verify resolved path is strictly within the authorized uploads directory
    if (!resolvedPath.startsWith(uploadBaseDir)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to requested file path is restricted.' })
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Requested file not found on disk.' })
    }

    return res.download(resolvedPath, originalName)
  } catch (error) {
    next(error)
  }
}

/**
 * Controller: View/Stream an uploaded file inline
 * GET /api/submissions/:id/view/:fileType
 */
export const viewSubmissionFile = async (req, res, next) => {
  try {
    const { id, fileType } = req.params

    const rawSubmission = await prisma.submission.findUnique({
      where: { id },
    })

    if (!rawSubmission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' })
    }

    const submission = decryptSubmissionRecord(rawSubmission)

    let filePath = null
    let originalName = null

    if (fileType === 'assignment') {
      filePath = submission.assignmentPath
      originalName = submission.assignmentName
    } else if (fileType === 'report' || fileType === 'poster') {
      filePath = submission.reportPath
      originalName = submission.reportName
    } else {
      return res.status(400).json({ success: false, message: 'Invalid fileType. Must be assignment or poster/report.' })
    }

    if (!filePath) {
      return res.status(404).json({ success: false, message: 'Requested deliverable not attached to this submission.' })
    }

    const resolvedPath = path.resolve(filePath)

    // Defense-in-depth: Verify resolved path is strictly within the authorized uploads directory
    if (!resolvedPath.startsWith(uploadBaseDir)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to requested file path is restricted.' })
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Requested file not found on disk.' })
    }

    const ext = path.extname(originalName || resolvedPath).toLowerCase()
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // If browser navigates directly to this URL for a Word doc (.docx/.doc), redirect to interactive client viewer
    if (['.docx', '.doc'].includes(ext) && req.headers.accept?.includes('text/html')) {
      const clientOrigin = req.headers.referer ? new URL(req.headers.referer).origin : 'http://localhost:5174'
      return res.redirect(`${clientOrigin}/#viewer?id=${id}&type=${fileType}`)
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline')

    return res.sendFile(resolvedPath)
  } catch (error) {
    next(error)
  }
}

/**
 * Controller: Delete a submission record and its associated physical files
 * DELETE /api/submissions/:id
 */
export const deleteSubmission = async (req, res, next) => {
  try {
    const { id } = req.params

    const rawSubmission = await prisma.submission.findUnique({
      where: { id },
    })

    if (!rawSubmission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' })
    }

    const submission = decryptSubmissionRecord(rawSubmission)

    // Remove assignment file from disk if present
    if (submission.assignmentPath) {
      const resolvedAssignment = path.resolve(submission.assignmentPath)
      if (resolvedAssignment.startsWith(uploadBaseDir) && fs.existsSync(resolvedAssignment)) {
        try {
          fs.unlinkSync(resolvedAssignment)
        } catch (e) {
          console.error('Failed to unlink assignment file:', e.message)
        }
      }
    }

    // Remove report/poster file from disk if present
    if (submission.reportPath) {
      const resolvedReport = path.resolve(submission.reportPath)
      if (resolvedReport.startsWith(uploadBaseDir) && fs.existsSync(resolvedReport)) {
        try {
          fs.unlinkSync(resolvedReport)
        } catch (e) {
          console.error('Failed to unlink report file:', e.message)
        }
      }
    }

    // Delete record from database
    await prisma.submission.delete({
      where: { id },
    })

    invalidateSubmissionsCache()

    return res.status(200).json({
      success: true,
      message: 'Submission and deliverables deleted successfully.',
      id,
    })
  } catch (error) {
    next(error)
  }
}
