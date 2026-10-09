import { prisma } from '@/lib/prisma'
import type { CollectionEntryInput } from '@/lib/collection/validation'

/** Guarda (crea o actualiza) un perfume en la colección de la persona. `data` ya debe estar validado. */
export async function upsertCollectionForUser(userId: string, data: CollectionEntryInput) {
  return prisma.userCollection.upsert({
    where: { userId_perfumeId: { userId, perfumeId: data.perfumeId } },
    update: { status: data.status, rating: data.rating ?? null, personalNotes: data.personalNotes ?? null },
    create: { userId, perfumeId: data.perfumeId, status: data.status, rating: data.rating, personalNotes: data.personalNotes },
  })
}
