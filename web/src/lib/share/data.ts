import { prisma } from '@/lib/prisma'
import { generateShareToken, hashShareToken, isValidShareToken } from './token'
import { shareOwnerLabel, toPublicEntries, type PublicEntry, type ShareScope } from './view'

// Acceso a datos de los links para compartir la colección. Cada función de escritura recibe el
// `userId` de la sesión del servidor. La lectura pública solo selecciona los campos de `SharedRow`
// (nunca notas personales ni email) y solo perfumes PUBLISHED.
export async function createOrReplaceShare(userId: string, scope: ShareScope, showRatings: boolean): Promise<{ token: string }> {
  const { token, tokenHash } = generateShareToken()
  const effectiveRatings = scope === 'OWNED' && showRatings
  await prisma.collectionShare.upsert({
    where: { userId_scope: { userId, scope } },
    create: { userId, scope, showRatings: effectiveRatings, tokenHash },
    update: { showRatings: effectiveRatings, tokenHash, createdAt: new Date() },
    select: { id: true },
  })
  return { token }
}

export async function revokeShare(userId: string, scope: ShareScope): Promise<void> {
  await prisma.collectionShare.deleteMany({ where: { userId, scope } })
}

export async function listShares(userId: string): Promise<{ scope: ShareScope; showRatings: boolean; createdAt: Date }[]> {
  return prisma.collectionShare.findMany({
    where: { userId },
    select: { scope: true, showRatings: true, createdAt: true },
    orderBy: { scope: 'asc' },
  })
}

export async function getPublicShare(
  token: string,
): Promise<{ ownerLabel: string; scope: ShareScope; showRatings: boolean; entries: PublicEntry[] } | null> {
  if (!isValidShareToken(token)) return null

  const share = await prisma.collectionShare.findUnique({
    where: { tokenHash: hashShareToken(token) },
    select: { userId: true, scope: true, showRatings: true },
  })
  if (!share) return null

  const [rows, profile] = await Promise.all([
    prisma.userCollection.findMany({
      where: { userId: share.userId, status: share.scope, perfume: { status: 'PUBLISHED' } },
      select: { rating: true, perfume: { select: { id: true, brand: true, name: true, gender: true, imageUrl: true } } },
      orderBy: [{ perfume: { brand: 'asc' } }, { perfume: { name: 'asc' } }],
    }),
    prisma.userProfile.findUnique({ where: { userId: share.userId }, select: { nickname: true } }),
  ])

  const showRatings = share.scope === 'OWNED' && share.showRatings
  return {
    ownerLabel: shareOwnerLabel(profile?.nickname),
    scope: share.scope,
    showRatings,
    entries: toPublicEntries(rows, { scope: share.scope, showRatings }),
  }
}
