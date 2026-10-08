import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

const adapter = new PrismaPg(process.env.DATABASE_URL)
const prisma = new PrismaClient({ adapter })

async function main() {
  const collections = await prisma.userCollection.findMany({
    select: { status: true }
  })

  console.log(`Total rows: ${collections.length}`)
  const uniqueStatuses = [...new Set(collections.map(c => c.status))]
  console.log('Unique statuses:', uniqueStatuses)

  await prisma.$disconnect()
}

main().catch(console.error)
