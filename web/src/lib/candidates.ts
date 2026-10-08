import { prisma } from '@/lib/prisma'
import { getAccordStats } from '@/lib/accord-stats'
import type { PerfumeWithRelations } from '@/lib/similarity'

// Cantidad de acordes de la referencia (los más característicos) que acotan los candidatos.
const SEED_ACCORDS = 3
// Intensidad mínima del acorde en el candidato para entrar al conjunto.
const CANDIDATE_MIN_INTENSITY = 40
// Cuántos de esos acordes característicos debe compartir un candidato como mínimo.
const MIN_SHARED_SEEDS = 2

// Recupera los perfumes que comparten con la referencia al menos MIN_SHARED_SEEDS de sus
// acordes más característicos. "Característico" = intensidad × rareza: un acorde presente en
// medio catálogo (amaderado) no acota nada, así que se priorizan los distintivos. Con decenas
// de miles de perfumes, traer todo lo que comparta *algún* acorde o nota trae miles de filas
// que casi nunca llegan al ranking. El puntaje sigue usando todos los acordes y notas.
//
// Dos consultas en paralelo (acordes y notas de los candidatos) con la misma subconsulta de
// ids, en vez del `select` anidado de Prisma, que hace una ida y vuelta por lote de miles de ids.
// La marca y el nombre los pide quien llama, solo para el top.
export async function fetchCandidates(reference: {
  id: string
  accords: ReadonlyArray<{ accordId: string; intensity: number }>
}): Promise<PerfumeWithRelations[]> {
  // Referencia sin acordes: no hay base para acotar candidatos.
  if (reference.accords.length === 0) return []

  const { total, dfById } = await getAccordStats()
  const seedAccordIds = reference.accords
    .map((a) => ({
      accordId: a.accordId,
      weight: a.intensity * Math.log(total / Math.max(dfById.get(a.accordId) ?? 1, 1)),
    }))
    .sort((a, b) => b.weight - a.weight || a.accordId.localeCompare(b.accordId))
    .slice(0, SEED_ACCORDS)
    .map((a) => a.accordId)
  const minShared = Math.min(MIN_SHARED_SEEDS, seedAccordIds.length)

  const [accords, notes] = await Promise.all([
    prisma.$queryRaw<Array<{ perfumeId: string; accordId: string; intensity: number }>>`
      SELECT "perfumeId", "accordId", intensity::int AS intensity FROM "PerfumeAccord"
      WHERE "perfumeId" IN (
        SELECT c."perfumeId" FROM "PerfumeAccord" c
        JOIN "Perfume" p ON p.id = c."perfumeId" AND p.status = 'PUBLISHED'
        WHERE c."accordId" = ANY(${seedAccordIds}::text[])
          AND c.intensity >= ${CANDIDATE_MIN_INTENSITY}
          AND c."perfumeId" <> ${reference.id}
        GROUP BY c."perfumeId"
        HAVING COUNT(*) >= ${minShared}
      )`,
    prisma.$queryRaw<Array<{ perfumeId: string; noteId: string; noteType: string }>>`
      SELECT "perfumeId", "noteId", "noteType" FROM "PerfumeNote"
      WHERE "perfumeId" IN (
        SELECT c."perfumeId" FROM "PerfumeAccord" c
        JOIN "Perfume" p ON p.id = c."perfumeId" AND p.status = 'PUBLISHED'
        WHERE c."accordId" = ANY(${seedAccordIds}::text[])
          AND c.intensity >= ${CANDIDATE_MIN_INTENSITY}
          AND c."perfumeId" <> ${reference.id}
        GROUP BY c."perfumeId"
        HAVING COUNT(*) >= ${minShared}
      )`,
  ])

  const byId = new Map<
    string,
    {
      id: string
      accords: Array<{ accordId: string; intensity: number }>
      notes: Array<{ noteId: string; noteType: string }>
    }
  >()
  for (const row of accords) {
    const entry = byId.get(row.perfumeId) ?? { id: row.perfumeId, accords: [], notes: [] }
    entry.accords.push({ accordId: row.accordId, intensity: row.intensity })
    byId.set(row.perfumeId, entry)
  }
  for (const row of notes) {
    // Todo candidato aparece en `accords` (la subconsulta parte de PerfumeAccord).
    byId.get(row.perfumeId)?.notes.push({ noteId: row.noteId, noteType: row.noteType })
  }
  return [...byId.values()]
}
