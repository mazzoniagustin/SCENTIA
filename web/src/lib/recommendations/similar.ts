import { prisma } from '@/lib/prisma'
import { fetchCandidates } from '@/lib/candidates'
import { getUserCollectionEntries } from '@/lib/exclusions'
import { calculateSimilarityScore, EXCLUDED_STATUSES } from '@/lib/similarity'
import { createTtlCache } from '@/lib/ttl-cache'
import { sharedCache } from '@/lib/shared-cache'

// Perfumes similares a uno de referencia (motor determinista de similarity.ts).
// Compartido por GET /api/perfumes/[id]/recommendations y la ficha del perfume.
// `reasons` explica por qué el candidato está en el ranking: comparte acordes, notas, o ambos.
// El vocabulario es cerrado para que el cliente lo renderice sin lógica de inferencia.

export type RecommendationReason = 'shared_accords' | 'shared_notes'

export type Recommendation = {
  perfumeId: string
  brand: string
  name: string
  score: number
  reasons: RecommendationReason[]
}

export const DEFAULT_LIMIT = 10
export const MAX_LIMIT = 50

// El ranking (sin exclusiones personales) depende solo de los datos del catálogo, que cambian al importar o
// publicar: se guarda 10 minutos. Se guardan más de MAX_LIMIT para poder descontar lo que la persona ya tiene.
const RANKING_SIZE = 100
const rankingCache = createTtlCache<Recommendation[] | null>({
  ttlMs: 10 * 60 * 1000,
  maxEntries: 300,
  cacheIf: (ranking) => ranking !== null, // un perfume inexistente o en borrador no se cachea
})

// Determina los motivos de similitud comparando los identificadores compartidos
// con la referencia. No se repite el cálculo de scoring: solo se reutilizan los
// conjuntos de ids ya cargados.
function buildReasons(
  candidateAccordIds: ReadonlyArray<string>,
  candidateNoteIds: ReadonlyArray<string>,
  referenceAccordIds: ReadonlySet<string>,
  referenceNoteIds: ReadonlySet<string>,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = []
  if (candidateAccordIds.some((id) => referenceAccordIds.has(id))) {
    reasons.push('shared_accords')
  }
  if (candidateNoteIds.some((id) => referenceNoteIds.has(id))) {
    reasons.push('shared_notes')
  }
  return reasons
}

async function computeRankingUncached(referenceId: string): Promise<Recommendation[] | null> {
  const reference = await prisma.perfume.findUnique({
    where: { id: referenceId },
    select: {
      id: true,
      status: true,
      accords: { select: { accordId: true, intensity: true } },
      notes: { select: { noteId: true, noteType: true } },
    },
  })
  if (!reference || reference.status !== 'PUBLISHED') return null

  const candidates = await fetchCandidates(reference)
  const referenceAccordIds = new Set(reference.accords.map((a) => a.accordId))
  const referenceNoteIds = new Set(reference.notes.map((n) => n.noteId))

  const ranked = candidates
    .map((candidate) => ({ candidate, score: calculateSimilarityScore(reference, candidate) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id)) // orden total: mismo resultado siempre
    .slice(0, RANKING_SIZE)

  // Marca y nombre solo del top, no de los miles de candidatos.
  const meta = new Map(
    (
      await prisma.perfume.findMany({
        where: { id: { in: ranked.map(({ candidate }) => candidate.id) } },
        select: { id: true, brand: true, name: true },
      })
    ).map((p) => [p.id, p]),
  )

  return ranked.map(({ candidate, score }) => ({
    perfumeId: candidate.id,
    brand: meta.get(candidate.id)!.brand,
    name: meta.get(candidate.id)!.name,
    // Redondeo a 2 decimales en la capa de API; el score interno es pleno.
    score: Math.round(score * 100) / 100,
    reasons: buildReasons(
      (candidate.accords ?? []).map((a) => a.accordId),
      (candidate.notes ?? []).map((n) => n.noteId),
      referenceAccordIds,
      referenceNoteIds,
    ),
  }))
}

// Ranking común (sin datos personales): se comparte entre instancias para que un perfume ya visto no se recalcule.
const computeRanking = sharedCache(computeRankingUncached, 'similar-ranking')

/**
 * Devuelve null si el perfume de referencia no existe o no está publicado. `userId` es el cuid de la tabla
 * User (no el UUID de Supabase); si se omite no se descuenta lo que la persona tiene o descartó.
 */
export async function getSimilarPerfumes(
  referenceId: string,
  options: { limit?: number; userId?: string | null } = {},
): Promise<Recommendation[] | null> {
  const ranking = await rankingCache.getOrCompute(referenceId, () => computeRanking(referenceId))
  if (ranking === null) return null

  // La exclusión por colección es personal: se aplica sobre el ranking común, fuera de la caché.
  const collection = await getUserCollectionEntries(options.userId)
  const excluded = new Set(
    collection.filter((entry) => EXCLUDED_STATUSES.has(entry.status.toLowerCase())).map((entry) => entry.perfumeId),
  )
  return ranking.filter((item) => !excluded.has(item.perfumeId)).slice(0, options.limit ?? DEFAULT_LIMIT)
}
