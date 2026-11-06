import dotenv from 'dotenv'
dotenv.config()

import app from './src/app.js'
import prisma from './src/config/prisma.js'

const PORT = process.env.PORT || 5000

// Initialize and start server
async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect()
    console.log('✓ Successfully connected to local SQL database via Prisma.')

    app.listen(PORT, () => {
      console.log(`===============================================`)
      console.log(`🚀 PSD Backend Server running on port ${PORT}`)
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`)
      console.log(`📥 Submissions:  http://localhost:${PORT}/api/submissions`)
      console.log(`💾 Database:     ${process.env.DATABASE_URL || 'Local SQL'}`)
      console.log(`===============================================`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  console.log('\nPrisma client disconnected. Server closed.')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  console.log('\nPrisma client disconnected. Server closed.')
  process.exit(0)
})

