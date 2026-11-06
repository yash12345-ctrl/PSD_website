/**
 * Security Headers Middleware (Alternative to Helmet for zero-dependency setups)
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}

/**
 * Lightweight In-Memory Rate Limiter
 * @param {object} options
 * @param {number} options.windowMs Window duration in ms
 * @param {number} options.max Maximum requests permitted in window
 * @param {string} options.message Error message returned upon exceeding limit
 */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests. Please try again later.' }) {
  const store = new Map()

  // Cleanup expired buckets every 5 minutes
  setInterval(() => {
    const now = Date.now()
    for (const [ip, data] of store.entries()) {
      if (now > data.resetTime) {
        store.delete(ip)
      }
    }
  }, 5 * 60 * 1000).unref()

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    const now = Date.now()

    let record = store.get(ip)
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs }
      store.set(ip, record)
      return next()
    }

    record.count += 1
    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000))
      return res.status(429).json({
        success: false,
        message,
      })
    }

    next()
  }
}

