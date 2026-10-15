// Ranking de candidatos del catálogo para cubrir los huecos de la colección. Puro y determinista: sin base, red ni
// LLM (ADR-009). Sigue el patrón del quiz: rareza (IDF) y popularidad con `applyPopularity`, el mismo desempate total.
//
// Qué se busca ("necesidades"): las familias y los valores de estación, día/noche y duración marcados como hueco
// (peso NEED_WEIGHT_GAP) o cobertura débil (NEED_WEIGHT_WEAK). "No explorado" y la estela no se buscan.
//
//   cobertura = Σ peso de las necesidades que el perfume cubre / Σ peso de todas las necesidades
//   fondo     = promedio, ponderado por peso, de qué tan a fondo cubre cada una (familia: intensidad × rareza; dimensión: 1)
//   puntaje   = cobertura × fondo, mezclado con la popularidad
//
// Qué se excluye: lo que la persona ya tiene o probó (OWNED, SAMPLED) y lo que descartó (DISLIKED), solo ese perfume
// exacto (sus acordes no se penalizan). Lo de la lista de deseados (WISHLIST) puede aparecer, marcado.
// Del top, como mucho MAX_PER_BRAND de la misma marca: se recorre el orden por puntaje y se saltea al excedente.

import { applyPopularity } from '../quiz/scoring.ts'
import { ACCORD_PRESENCE_MIN_INTENSITY } from './analyze.ts'
import { profileOf, type Dimension } from './dimensions.ts'
import { FAMILY_ACCORDS, type FamilyCode } from './families.ts'
import type { DimensionsReport } from './dimensions.ts'
import type { CollectionSample, CollectionStatus, FamilyReport } from './types.ts'

/** Cantidad de sugerencias que se devuelven como máximo. */
export const MAX_CANDIDATES = 5
/** Menos que esto se considera una lista corta (`complete: false`); se devuelven igual las que haya. */
export const MIN_CANDIDATES = 3
/** Máximo de sugerencias de la misma marca en el top (sin distinguir mayúsculas), para que no lo copie una sola casa. */
export const MAX_PER_BRAND = 2
export const NEED_WEIGHT_GAP = 1
export const NEED_WEIGHT_WEAK = 0.5
/** Cuánto pesa la rareza del acorde en el fondo de una familia (misma forma que la popularidad del quiz). */
export const RARITY_WEIGHT = 0.3
/** IDF desde el cual un acorde cuenta como "raro" al 100 %: ln(10) = presente en el 10 % del catálogo o menos. */
export const IDF_SATURATION = Math.log(10)
/** Mismo peso de popularidad que el quiz. */
export const POPULARITY_WEIGHT = 0.3
/** Etiqueta para los candidatos que ya están en la lista de deseados. */
export const WISHLIST_LABEL = 'Ya lo tenés en tu lista de deseados'

/** Estados que sacan al perfume de las sugerencias. SAMPLED es "Probé una muestra". */
export const EXCLUDED_FROM_SUGGESTIONS: ReadonlySet<CollectionStatus> = new Set(['OWNED', 'SAMPLED', 'DISLIKED'])

export type Need =
  | { kind: 'family'; family: FamilyCode; weight: number }
  | { kind: 'dimension'; dimension: Dimension; value: string; weight: number }

/** Lo que cubre un candidato, en códigos (sin texto libre). */
export type Covered = { kind: 'family'; family: FamilyCode } | { kind: 'dimension'; dimension: Dimension; value: string }

export type RankCandidate = Pick<CollectionSample, 'perfumeId' | 'accords' | 'seasons' | 'occasions' | 'longevity' | 'sillage'> & {
  brand: string
  /** Estado del perfume en la colección de la persona; null si no está. */
  collectionStatus: CollectionStatus | null
  /** Popularidad 0-1. Sin dato = 0. */
  popularity?: number
}

export type Suggestion = {
  perfumeId: string
  score: number
  covers: Covered[]
  /** true si ya está en WISHLIST: la interfaz muestra WISHLIST_LABEL. */
  inWishlist: boolean
}

export type SuggestionResult = {
  suggestions: Suggestion[]
  /** false si hay menos de MIN_CANDIDATES. */
  complete: boolean
  /** Necesidades buscadas; vacío si no hay huecos. */
  needs: Need[]
}

/** Necesidades a partir de los informes. Solo con status 'ok' hay necesidades. */
export function buildNeeds(families: FamilyReport, dimensions: DimensionsReport): Need[] {
  const needs: Need[] = []
  if (families.status === 'ok') {
    for (const c of families.gaps) needs.push({ kind: 'family', family: c.family, weight: NEED_WEIGHT_GAP })
    for (const c of families.weak) needs.push({ kind: 'family', family: c.family, weight: NEED_WEIGHT_WEAK })
  }
  if (dimensions.status === 'ok') {
    for (const result of dimensions.dimensions) {
      for (const c of result.gaps) needs.push({ kind: 'dimension', dimension: result.dimension, value: c.value, weight: NEED_WEIGHT_GAP })
      for (const c of result.weak) needs.push({ kind: 'dimension', dimension: result.dimension, value: c.value, weight: NEED_WEIGHT_WEAK })
    }
  }
  return needs
}

/** Fondo con el que el candidato cubre una familia: 0 si no la cubre; si no, intensidad × rareza del mejor acorde. */
function familyDepth(candidate: RankCandidate, family: FamilyCode, idf: (name: string) => number): number {
  const names = new Set(FAMILY_ACCORDS[family])
  let best = 0
  for (const { name, intensity } of candidate.accords) {
    if (!names.has(name) || intensity < ACCORD_PRESENCE_MIN_INTENSITY) continue
    const rarity = Math.min(Math.max(idf(name) / IDF_SATURATION, 0), 1)
    best = Math.max(best, applyPopularity(Math.min(intensity, 100) / 100, rarity, RARITY_WEIGHT))
  }
  return best
}

/** Fondo con el que el candidato cubre una necesidad (0 = no la cubre). */
function needDepth(candidate: RankCandidate, need: Need, idf: (name: string) => number): number {
  if (need.kind === 'family') return familyDepth(candidate, need.family, idf)
  return profileOf(candidate)[need.dimension]?.includes(need.value) ? 1 : 0
}

export function rankSuggestions(
  needs: readonly Need[],
  candidates: readonly RankCandidate[],
  idf: (name: string) => number,
  limit = MAX_CANDIDATES,
): SuggestionResult {
  const totalWeight = needs.reduce((sum, n) => sum + n.weight, 0)
  if (totalWeight === 0) return { suggestions: [], complete: false, needs: [...needs] }

  const ranked = candidates
    .filter((c) => c.collectionStatus === null || !EXCLUDED_FROM_SUGGESTIONS.has(c.collectionStatus))
    .map((candidate) => {
      let coveredWeight = 0
      let depthSum = 0
      const covers: Covered[] = []
      for (const need of needs) {
        const depth = needDepth(candidate, need, idf)
        if (depth <= 0) continue
        coveredWeight += need.weight
        depthSum += need.weight * depth
        covers.push(
          need.kind === 'family'
            ? { kind: 'family', family: need.family }
            : { kind: 'dimension', dimension: need.dimension, value: need.value },
        )
      }
      const score = coveredWeight === 0 ? 0 : applyPopularity((coveredWeight / totalWeight) * (depthSum / coveredWeight), candidate.popularity, POPULARITY_WEIGHT)
      return { candidate, score, covers }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.covers.length - a.covers.length || a.candidate.perfumeId.localeCompare(b.candidate.perfumeId))

  const max = Math.min(Math.max(limit, 0), MAX_CANDIDATES)
  const perBrand = new Map<string, number>()
  const picked: typeof ranked = []
  for (const entry of ranked) {
    if (picked.length >= max) break
    const brand = entry.candidate.brand.trim().toLowerCase()
    const used = perBrand.get(brand) ?? 0
    if (used >= MAX_PER_BRAND) continue
    perBrand.set(brand, used + 1)
    picked.push(entry)
  }

  const suggestions = picked.map(({ candidate, score, covers }) => ({
    perfumeId: candidate.perfumeId,
    score,
    covers,
    inWishlist: candidate.collectionStatus === 'WISHLIST',
  }))
  return { suggestions, complete: suggestions.length >= MIN_CANDIDATES, needs: [...needs] }
}
