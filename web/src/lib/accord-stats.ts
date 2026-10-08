import { prisma } from '@/lib/prisma'
import { createTtlCache } from '@/lib/ttl-cache'

// Cuántos perfumes tienen cada acorde (frecuencia de documento) y cuántos perfumes hay.
// Sirve para ponderar por rareza (IDF) en el quiz y en los candidatos de "similares".
// Solo cambia al importar datos, así que se cachea en memoria del proceso.

export type AccordStats = {
  total: number
  /** Mayor cantidad de valoraciones de un perfume; normaliza la popularidad (0-1). */
  maxRatingCount: number
  dfById: ReadonlyMap<string, number>
  dfByName: ReadonlyMap<string, number>
}

const TTL_MS = 60 * 60 * 1000

let cache: { at: number; stats: AccordStats } | null = null

export async function getAccordStats(): Promise<AccordStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stats

  const [rows, total, ratings] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; df: number }>>`
      SELECT a.id, a.name, COUNT(*)::int AS df
      FROM "PerfumeAccord" pa JOIN "Accord" a ON a.id = pa."accordId"
      GROUP BY a.id, a.name`,
    prisma.perfume.count(),
    prisma.perfume.aggregate({ _max: { ratingCount: true } }),
  ])
  const stats: AccordStats = {
    total,
    maxRatingCount: ratings._max.ratingCount ?? 0,
    dfById: new Map(rows.map((r) => [r.id, r.df])),
    dfByName: new Map(rows.map((r) => [r.name, r.df])),
  }
  cache = { at: Date.now(), stats }
  return stats
}

// Los nombres de acorde solo cambian al reimportar el catálogo.
const accordNamesCache = createTtlCache<string[]>({ ttlMs: TTL_MS })

/** Nombres de todos los acordes, ordenados (opciones del filtro del catálogo). */
export function getAccordNames(): Promise<string[]> {
  return accordNamesCache.getOrCompute('all', async () =>
    (await prisma.accord.findMany({ select: { name: true }, orderBy: { name: 'asc' } })).map((a) => a.name),
  )
}
