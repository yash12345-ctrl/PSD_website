  import { Router } from 'express'
import {
  createSubmission,
  getAllSubmissions,
  getSubmissionById,
  downloadSubmissionFile,
  viewSubmissionFile,
} from '../controllers/submissionController.js'
import { uploadSubmissionFiles } from '../config/upload.js'
import { requireAdminAuth } from '../middlewares/authMiddleware.js'
import { createRateLimiter } from '../middlewares/security.js'

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Submission limit reached for this IP. Please wait before submitting again.',
})

const router = Router()

// Route: Upload & submit assignment/report (Public student endpoint with upload limiter)
router.post('/', uploadLimiter, uploadSubmissionFiles, createSubmission)

// Route: List all submissions (Protected Admin endpoint)
router.get('/', requireAdminAuth, getAllSubmissions)

// Route: Get submission details by ID or Reference ID (Protected Admin endpoint)
router.get('/:identifier', requireAdminAuth, getSubmissionById)

// Route: View/Stream uploaded file inline (Protected Admin endpoint)
router.get('/:id/view/:fileType', requireAdminAuth, viewSubmissionFile)

// Route: Download uploaded file (Protected Admin endpoint)
router.get('/:id/download/:fileType', requireAdminAuth, downloadSubmissionFile)

export default router

