import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 ya no toma la URL del datasource del schema; se inyecta mediante
// un driver adapter. PrismaPg acepta un connection string directo.
const adapter = new PrismaPg(process.env.DATABASE_URL as string)

// Evita agotar conexiones en desarrollo: con hot reload, cada recarga
// crearía una nueva instancia de PrismaClient si no se reutiliza la global.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}