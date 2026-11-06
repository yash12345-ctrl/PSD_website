import prisma from '../config/prisma.js'
import { encryptSubmissionData, isEncrypted } from '../utils/encryption.js'

async function migrateExistingRecords() {
  console.log('🔄 Checking database records for unencrypted user data...')

  const submissions = await prisma.submission.findMany()
  console.log(`Found ${submissions.length} total records in database.`)

  let migratedCount = 0

  for (const sub of submissions) {
    const needsMigration =
      (sub.name && !isEncrypted(sub.name)) ||
      (sub.regNo && !isEncrypted(sub.regNo)) ||
      (sub.section && !isEncrypted(sub.section)) ||
      (sub.email && !isEncrypted(sub.email)) ||
      (sub.principle && !isEncrypted(sub.principle)) ||
      (sub.assignmentName && !isEncrypted(sub.assignmentName)) ||
      (sub.reportName && !isEncrypted(sub.reportName))

    if (needsMigration) {
      const encryptedData = encryptSubmissionData({
        name: sub.name,
        regNo: sub.regNo,
        section: sub.section,
        email: sub.email,
        principle: sub.principle,
        assignmentName: sub.assignmentName,
        reportName: sub.reportName,
      })

      await prisma.submission.update({
        where: { id: sub.id },
        data: encryptedData,
      })

      migratedCount++
      console.log(`✓ Migrated and encrypted submission ID: ${sub.id}`)
    }
  }

  console.log(`\n🎉 Migration complete! ${migratedCount} submission(s) encrypted in database.`)
}

migrateExistingRecords()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

