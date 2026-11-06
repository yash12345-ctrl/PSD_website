import { Router } from 'express'
import { adminLogin, adminVerify } from '../controllers/adminController.js'
import { requireAdminAuth } from '../middlewares/authMiddleware.js'

const router = Router()

// Route: Authenticate admin credentials
router.post('/login', adminLogin)

// Route: Validate current admin session
router.get('/verify', requireAdminAuth, adminVerify)

export default router

