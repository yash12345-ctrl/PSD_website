import multer from 'multer'

/**
 * 404 Not Found Middleware
 */
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Not Found - ${req.originalUrl}`,
  })
}

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (err, req, res, _next) => {
  console.error('API Error:', err.message)

  // Handle Multer upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum allowed size is 25 MB per file.',
      })
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name. Use "assignment" and "report" fields.',
      })
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    })
  }

  // Handle Prisma unique constraint error
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A submission with this reference ID already exists.',
    })
  }

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
