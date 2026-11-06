import { PrismaClient } from '@prisma/client'

// Singleton Prisma client instance
// Keep terminal clean and quiet without verbose raw SQL query dumps
const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error', 'warn'],
})

export default prisma

