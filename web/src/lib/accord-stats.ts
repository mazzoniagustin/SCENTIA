import { prisma } from '@/lib/prisma'

// Cuántos perfumes tienen cada acorde (frecuencia de documento) y cuántos perfumes hay.
// Sirve para ponderar por rareza (IDF) en el quiz y en los candidatos de "similares".
// Solo cambia al importar datos, así que se cachea en memoria del proceso.

export type AccordStats = {
  total: number
  dfById: ReadonlyMap<string, number>
  dfByName: ReadonlyMap<string, number>
}

const TTL_MS = 60 * 60 * 1000

let cache: { at: number; stats: AccordStats } | null = null

export async function getAccordStats(): Promise<AccordStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stats

  const [rows, total] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; df: number }>>`
      SELECT a.id, a.name, COUNT(*)::int AS df
      FROM "PerfumeAccord" pa JOIN "Accord" a ON a.id = pa."accordId"
      GROUP BY a.id, a.name`,
    prisma.perfume.count(),
  ])
  const stats: AccordStats = {
    total,
    dfById: new Map(rows.map((r) => [r.id, r.df])),
    dfByName: new Map(rows.map((r) => [r.name, r.df])),
  }
  cache = { at: Date.now(), stats }
  return stats
}
