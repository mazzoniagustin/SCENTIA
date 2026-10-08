// Puntaje de un perfume contra un perfil olfativo (ver docs/quiz-perfil-olfativo.md).
//
//   w[a]  = ln(N / df[a])                                   (ponderación por rareza, IDF)
//   score = Σ w[a]·min(P[a], I[a]) / Σ w[a]·P[a]             ∈ [0, 1]
//
// Un perfume con un acorde rechazado en intensidad >= AVOID_THRESHOLD queda excluido (0).
// Función pura y determinista: el desempate es total (puntaje, coincidencias, id).

import { EXCLUDED_STATUSES, type UserCollectionEntry } from '../similarity.ts'
import type { OlfactoryProfile } from './profile.ts'

/** Intensidad desde la cual un acorde rechazado descarta al perfume. */
export const AVOID_THRESHOLD = 60
/** Cantidad máxima de acordes coincidentes que se informan como razón. */
export const MAX_MATCHED_ACCORDS = 3

export type CandidateAccord = { name: string; intensity: number }

export type QuizCandidate = {
  id: string
  accords: ReadonlyArray<CandidateAccord>
  /** Popularidad 0-1 (cantidad de valoraciones, en escala logarítmica). Sin dato = 0. */
  popularity?: number
}

export type QuizReason = 'matched_accords' | 'avoids_rejected'

export type QuizScore = {
  score: number
  /** Acordes que más aportaron al puntaje, de mayor a menor. */
  matchedAccords: string[]
  excluded: boolean
}

export type QuizRecommendation = {
  perfumeId: string
  score: number
  matchedAccords: string[]
  reasons: QuizReason[]
}

/**
 * Peso IDF por acorde. `df` es la cantidad de perfumes que tienen cada acorde y
 * `total` el total de perfumes. Un acorde sin datos cuenta como df = 1 (el más raro).
 */
export function buildIdf(df: ReadonlyMap<string, number>, total: number): (name: string) => number {
  return (name) => {
    const count = Math.max(df.get(name) ?? 1, 1)
    // Un acorde presente en todos los perfumes no discrimina: peso 0, nunca negativo.
    return total > 0 ? Math.max(Math.log(total / count), 0) : 0
  }
}

export function scoreCandidate(
  profile: OlfactoryProfile,
  candidate: QuizCandidate,
  idf: (name: string) => number,
): QuizScore {
  const intensities = new Map(candidate.accords.map((accord) => [accord.name, accord.intensity]))

  const rejected = profile.avoid.some((name) => (intensities.get(name) ?? 0) >= AVOID_THRESHOLD)
  if (rejected) return { score: 0, matchedAccords: [], excluded: true }

  let total = 0
  let shared = 0
  const contributions: Array<{ name: string; value: number }> = []
  for (const [name, weight] of Object.entries(profile.weights)) {
    const w = idf(name)
    total += w * weight
    const intensity = intensities.get(name)
    if (intensity === undefined) continue
    const value = w * Math.min(weight, intensity)
    shared += value
    if (value > 0) contributions.push({ name, value })
  }

  // Sin masa en el perfil (perfil vacío o solo acordes sin poder discriminante): 0, no NaN.
  const score = total > 0 ? shared / total : 0
  const matchedAccords = contributions
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, MAX_MATCHED_ACCORDS)
    .map((c) => c.name)

  return { score, matchedAccords, excluded: false }
}

/**
 * Mezcla el puntaje con la popularidad: `score × (1 − w + w·popularidad)`. Con w = 0 no cambia nada.
 * Evita que, a igualdad de gusto, ganen siempre perfumes casi desconocidos (el IDF premia lo raro).
 */
export function applyPopularity(score: number, popularity: number | undefined, weight: number): number {
  const p = Math.min(Math.max(popularity ?? 0, 0), 1)
  return score * (1 - weight + weight * p)
}

/**
 * Ordena candidatos por afinidad. Descarta los de puntaje 0 y los de la colección con
 * estado excluyente (OWNED/DISLIKED, sin distinguir mayúsculas). Desempate: puntaje,
 * cantidad de acordes coincidentes, id.
 */
export function rankCandidates(
  profile: OlfactoryProfile,
  candidates: ReadonlyArray<QuizCandidate>,
  idf: (name: string) => number,
  options: { collection?: ReadonlyArray<UserCollectionEntry>; limit?: number; popularityWeight?: number } = {},
): QuizRecommendation[] {
  const excludedIds = new Set(
    (options.collection ?? [])
      .filter((entry) => EXCLUDED_STATUSES.has(entry.status.toLowerCase()))
      .map((entry) => entry.perfumeId),
  )

  const ranked = candidates
    .filter((candidate) => !excludedIds.has(candidate.id))
    .map((candidate) => {
      const result = scoreCandidate(profile, candidate, idf)
      return {
        candidate,
        result: { ...result, score: applyPopularity(result.score, candidate.popularity, options.popularityWeight ?? 0) },
      }
    })
    .filter(({ result }) => result.score > 0)
    .sort(
      (a, b) =>
        b.result.score - a.result.score ||
        b.result.matchedAccords.length - a.result.matchedAccords.length ||
        a.candidate.id.localeCompare(b.candidate.id),
    )

  return ranked.slice(0, options.limit ?? ranked.length).map(({ candidate, result }) => ({
    perfumeId: candidate.id,
    score: result.score,
    matchedAccords: result.matchedAccords,
    reasons: [
      'matched_accords',
      ...(profile.avoid.length > 0 ? (['avoids_rejected'] as const) : []),
    ],
  }))
}
