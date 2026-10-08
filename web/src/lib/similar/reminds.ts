import { prisma } from '@/lib/prisma'

// "Me recuerda a": perfumes que la comunidad de la fuente dice que huelen parecido (ver scripts/import-kaggle-similar.ts).

export type RemindsMe = {
  id: string
  brand: string
  name: string
  gender: string
  imageUrl: string | null
  upVotes: number
  downVotes: number
  /** Porcentaje (0-100) de votos a favor sobre el total. */
  agreement: number
  accords: Array<{ intensity: number; accord: { name: string } }>
}

export async function getRemindsMe(perfumeId: string, limit = 14): Promise<RemindsMe[]> {
  const rows = await prisma.perfumeSimilar.findMany({
    where: { perfumeId, similar: { status: 'PUBLISHED' } },
    orderBy: [{ net: 'desc' }, { upVotes: 'desc' }, { similarId: 'asc' }],
    take: limit,
    select: {
      upVotes: true,
      downVotes: true,
      similar: {
        select: {
          id: true,
          brand: true,
          name: true,
          gender: true,
          imageUrl: true,
          accords: { select: { intensity: true, accord: { select: { name: true } } }, orderBy: { intensity: 'desc' }, take: 3 },
        },
      },
    },
  })
  return rows.map((r) => ({
    ...r.similar,
    upVotes: r.upVotes,
    downVotes: r.downVotes,
    agreement: Math.round((r.upVotes / Math.max(1, r.upVotes + r.downVotes)) * 100),
  }))
}
