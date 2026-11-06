import { verifyAdminToken } from '../utils/auth.js'

/**
 * Middleware: Require valid signed admin token on protected endpoints
 */
export function requireAdminAuth(req, res, next) {
  let token = null

  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim()
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Authentication token is required to access admin resources.',
    })
  }

  const result = verifyAdminToken(token)
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      message: `Unauthorized: ${result.error || 'Invalid or expired session'}. Please sign in again.`,
    })
  }

  req.admin = result.payload
  next()
}

