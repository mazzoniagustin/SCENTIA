import { prisma } from '@/lib/prisma'
import { createTtlCache } from '@/lib/ttl-cache'
import type { BrandEntry } from '@/lib/brand-index'

// Marcas del catálogo publicado: índice A-Z y resumen por marca. Solo cambian al importar o publicar.

const TTL_MS = 60 * 60 * 1000

export type { BrandEntry } from '@/lib/brand-index'

const indexCache = createTtlCache<BrandEntry[]>({ ttlMs: TTL_MS, cacheIf: (v) => v.length > 0 })

export function getBrandIndex(): Promise<BrandEntry[]> {
  return indexCache.getOrCompute('all', () =>
    prisma.$queryRaw<BrandEntry[]>`
      SELECT brand, COUNT(*)::int AS count
      FROM "Perfume" WHERE status = 'PUBLISHED'
      GROUP BY brand
      ORDER BY brand ASC`,
  )
}

/** Nombre canónico de una marca a partir de lo que llega en la URL (sin distinguir mayúsculas), o null. */
export async function resolveBrand(raw: string): Promise<BrandEntry | null> {
  const wanted = raw.trim().toLowerCase()
  if (!wanted) return null
  return (await getBrandIndex()).find((e) => e.brand.toLowerCase() === wanted) ?? null
}

export type BrandSummary = { brand: string; count: number; topAccords: string[]; gendersCount: Record<string, number> }

const summaryCache = createTtlCache<BrandSummary>({ ttlMs: TTL_MS })

export function getBrandSummary(entry: BrandEntry): Promise<BrandSummary> {
  return summaryCache.getOrCompute(entry.brand, async () => {
    const [accords, genders] = await Promise.all([
      prisma.$queryRaw<Array<{ name: string }>>`
        SELECT a.name
        FROM "PerfumeAccord" pa
        JOIN "Accord" a ON a.id = pa."accordId"
        JOIN "Perfume" p ON p.id = pa."perfumeId"
        WHERE p.status = 'PUBLISHED' AND p.brand = ${entry.brand} AND pa.intensity >= 60
        GROUP BY a.name
        ORDER BY COUNT(*) DESC, a.name ASC
        LIMIT 6`,
      prisma.perfume.groupBy({ by: ['gender'], where: { status: 'PUBLISHED', brand: entry.brand }, _count: { _all: true } }),
    ])
    return {
      brand: entry.brand,
      count: entry.count,
      topAccords: accords.map((a) => a.name),
      gendersCount: Object.fromEntries(genders.map((g) => [g.gender, g._count._all])),
    }
  })
}
