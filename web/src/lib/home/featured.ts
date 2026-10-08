import { prisma } from '@/lib/prisma'
import { createTtlCache } from '@/lib/ttl-cache'
import type { Season } from '@/lib/seasons'

// Datos públicos de la portada. Solo cambian al importar o publicar, así que se cachean en memoria del proceso.

const TTL_MS = 60 * 60 * 1000
/** Mismo criterio de calidad que el perfume del día. */
const MIN_RATING_COUNT = 1000
const MIN_RATING_VALUE = 3.8

export type CatalogStats = { perfumes: number; brands: number; notes: number; accords: number }

const statsCache = createTtlCache<CatalogStats>({ ttlMs: TTL_MS })

export function getCatalogStats(): Promise<CatalogStats> {
  return statsCache.getOrCompute('stats', async () => {
    const [perfumes, brands, notes, accords] = await Promise.all([
      prisma.perfume.count({ where: { status: 'PUBLISHED' } }),
      prisma.$queryRaw<Array<{ n: number }>>`SELECT COUNT(DISTINCT brand)::int AS n FROM "Perfume" WHERE status = 'PUBLISHED'`,
      prisma.note.count(),
      prisma.accord.count(),
    ])
    return { perfumes, brands: brands[0]?.n ?? 0, notes, accords }
  })
}

export type FeaturedPerfume = {
  id: string
  brand: string
  name: string
  gender: string
  imageUrl: string | null
  accords: Array<{ intensity: number; accord: { name: string } }>
}

const featuredCache = createTtlCache<FeaturedPerfume[]>({ ttlMs: TTL_MS, cacheIf: (v) => v.length > 0 })

/** Los más valorados de la estación (por cantidad de valoraciones), sin repetir los ids excluidos. */
export function getSeasonalFeatured(season: Season, limit = 8, excludeIds: string[] = []): Promise<FeaturedPerfume[]> {
  return featuredCache.getOrCompute(`${season}|${limit}|${excludeIds.join(',')}`, async () => {
    const rows = await prisma.perfume.findMany({
      where: {
        status: 'PUBLISHED',
        seasons: { has: season },
        ratingCount: { gte: MIN_RATING_COUNT },
        ratingValue: { gte: MIN_RATING_VALUE },
        id: { notIn: excludeIds },
      },
      select: {
        id: true,
        brand: true,
        name: true,
        gender: true,
        imageUrl: true,
        accords: { select: { intensity: true, accord: { select: { name: true } } }, orderBy: { intensity: 'desc' } },
      },
      orderBy: [{ ratingCount: 'desc' }, { id: 'asc' }],
      take: limit,
    })
    return rows
  })
}

export type TopAccord = { name: string; count: number }

const accordsCache = createTtlCache<TopAccord[]>({ ttlMs: TTL_MS, cacheIf: (v) => v.length > 0 })

/** Acordes más frecuentes entre los perfumes publicados. */
export function getTopAccords(limit = 12): Promise<TopAccord[]> {
  return accordsCache.getOrCompute(String(limit), async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT a.name, COUNT(*)::int AS count
      FROM "PerfumeAccord" pa
      JOIN "Accord" a ON a.id = pa."accordId"
      JOIN "Perfume" p ON p.id = pa."perfumeId"
      WHERE p.status = 'PUBLISHED' AND pa.intensity >= 40
      GROUP BY a.name
      ORDER BY count DESC, a.name ASC
      LIMIT ${limit}`
    return rows
  })
}
