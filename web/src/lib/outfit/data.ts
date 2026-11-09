import 'server-only'

import { prisma } from '@/lib/prisma'
import { displayImageUrls } from '@/lib/private-perfumes/storage'
import type { OutfitCandidate } from './types'

// Tope de perfumes que se puntúan por pedido: acota la consulta y el trabajo del motor.
const MAX_CANDIDATES = 200

/** Perfumes publicados (y los propios con acordes) que la persona tiene (OWNED) o probó (SAMPLED), con sus acordes. */
export async function getOutfitCandidates(userId: string): Promise<OutfitCandidate[]> {
  const rows = await prisma.userCollection.findMany({
    where: {
      userId,
      status: { in: ['OWNED', 'DECANT', 'SAMPLED'] },
      perfume: { OR: [{ status: 'PUBLISHED' }, { status: 'PRIVATE', ownerId: userId, accords: { some: {} } }] },
    },
    select: {
      perfumeId: true,
      status: true,
      rating: true,
      perfume: {
        select: {
          status: true,
          brand: true,
          name: true,
          imageUrl: true,
          sillage: true,
          accords: { select: { intensity: true, accord: { select: { name: true } } } },
        },
      },
    },
    take: MAX_CANDIDATES,
  })
  const images = await displayImageUrls(rows.map((row) => row.perfume))
  return rows.map((row, i) => ({
    perfumeId: row.perfumeId,
    brand: row.perfume.brand,
    name: row.perfume.name,
    imageUrl: images[i],
    sillage: row.perfume.sillage,
    own: row.perfume.status === 'PRIVATE',
    slug: null,
    status: row.status,
    rating: row.rating,
    accords: row.perfume.accords.map((a) => ({ name: a.accord.name, intensity: a.intensity })),
  }))
}

/** Cantidad de entradas de la colección (cualquier estado): distingue "colección vacía" de "nada usable". */
export function countCollection(userId: string): Promise<number> {
  return prisma.userCollection.count({ where: { userId } })
}
