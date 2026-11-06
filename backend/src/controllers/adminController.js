import { verifyAdminCredentials, generateAdminToken } from '../utils/auth.js'

/**
 * Controller: Authenticate Admin credentials and issue secure signed token
 * POST /api/admin/login
 */
export async function adminLogin(req, res) {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID and Password are both required.',
      })
    }

    const isValid = verifyAdminCredentials(username, password)
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin ID or Password. Please try again.',
      })
    }

    const token = generateAdminToken({ username: String(username).trim() })

    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      token,
      expiresIn: 86400, // 24 hours in seconds
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Authentication service error.',
    })
  }
}

/**
 * Controller: Verify existing admin token
 * GET /api/admin/verify
 */
export async function adminVerify(req, res) {
  return res.status(200).json({
    success: true,
    valid: true,
    admin: req.admin,
  })
}

