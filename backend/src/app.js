import express from 'express'
import cors from 'cors'
import submissionRoutes from './routes/submissionRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import { notFound, errorHandler } from './middlewares/errorHandler.js'
import { securityHeaders, createRateLimiter } from './middlewares/security.js'

const app = express()

// Security headers
app.use(securityHeaders)

// Enable CORS with defensive origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000']

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching origin
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        return callback(null, true)
      }
      return callback(null, true) // allow development origins smoothly
    },
    credentials: true,
  })
)

// Parse JSON and URL-encoded form data with size limits
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// Rate limiters
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 attempts
  message: 'Too many admin login attempts from this IP. Please try again after 15 minutes.',
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'open-elective-submission-api',
    timestamp: new Date().toISOString(),
  })
})

// Admin Auth Routes
app.use('/api/admin', loginLimiter, adminRoutes)

// Submissions API routes
app.use('/api/submissions', submissionRoutes)

// Fallback 404 handler
app.use(notFound)

// Centralized error handler
app.use(errorHandler)

export default app

