import { prisma } from '@/lib/prisma'
import type { CollectionEntryInput } from '@/lib/collection/validation'

/** Un perfume propio (PRIVATE) solo se puede guardar en la colección de su dueño. Lanza si es de otra persona. */
export async function assertCollectable(userId: string, perfumeId: string) {
  const foreign = await prisma.perfume.count({ where: { id: perfumeId, status: 'PRIVATE', ownerId: { not: userId } } })
  if (foreign > 0) throw new Error('Perfume no disponible')
}

/** Guarda (crea o actualiza) un perfume en la colección de la persona. `data` ya debe estar validado. */
export async function upsertCollectionForUser(userId: string, data: CollectionEntryInput) {
  await assertCollectable(userId, data.perfumeId)
  return prisma.userCollection.upsert({
    where: { userId_perfumeId: { userId, perfumeId: data.perfumeId } },
    update: { status: data.status, rating: data.rating ?? null, personalNotes: data.personalNotes ?? null },
    create: { userId, perfumeId: data.perfumeId, status: data.status, rating: data.rating, personalNotes: data.personalNotes },
  })
}
