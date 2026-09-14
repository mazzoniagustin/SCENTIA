import { prisma } from '@/lib/prisma'
import type { UserCollectionEntry } from '@/lib/similarity'

// Entradas de la colección del usuario (perfumeId + estado). Sin sesión no hay
// exclusiones: devuelve una lista vacía. La exclusión en sí no se aplica aquí;
// se resuelve en el scoring (calculateSimilarityScore), que retorna 0 para los
// perfumes con estado 'owned' o 'disliked'.
export async function getUserCollectionEntries(
  userId?: string | null,
): Promise<UserCollectionEntry[]> {
  if (!userId) return []

  return prisma.userCollection.findMany({
    where: { userId },
    select: { perfumeId: true, status: true },
  })
}