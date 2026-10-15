// Arma la respuesta pública del análisis de huecos a partir del análisis interno. Puro. Define QUÉ sale hacia el
// navegador: conteos y porcentajes agregados, textos de plantilla y candidatos del catálogo público. Nunca sale:
// el id de la persona, ids de perfumes de su colección, notas privadas, sus puntajes ni el puntaje interno del ranking.

import { DIMENSION_LABELS, GAP_DIMENSIONS, VALUE_LABELS, type Dimension } from './dimensions.ts'
import { FAMILY_LABELS, type FamilyCode } from './families.ts'
import { WISHLIST_LABEL, type Need, type Suggestion } from './rank.ts'
import {
  DAY_NIGHT_NOTE,
  coveredLabel,
  dimensionGapText,
  dimensionUnexploredText,
  dimensionWeakText,
  familyGapText,
  familyUnexploredText,
  familyWeakText,
  guideFor,
  headlineText,
  insufficientDataText,
  type Guide,
} from './texts.ts'
import type { DimensionsReport } from './dimensions.ts'
import type { FamilyLevel, FamilyReport, ReportStatus } from './types.ts'

/** Lo mínimo del análisis interno que necesita la respuesta (compatible con GapAnalysis de data.ts). */
export type GapAnalysisInput = {
  families: FamilyReport
  dimensions: DimensionsReport
  needs: readonly Need[]
  suggestions: ReadonlyArray<Suggestion & { brand: string; name: string; gender: string; imageUrl: string | null }>
  complete: boolean
}

export type Finding = {
  kind: 'gap' | 'weak' | 'unexplored'
  area: 'family' | Dimension
  code: string
  label: string
  text: string
}

export type DistributionRow = { code: string; label: string; count: number; presence: number; catalogShare: number; level: FamilyLevel }

export type GapsResponse = {
  status: ReportStatus
  coverage: { used: number; skippedWithoutAccords: number; notUsable: number }
  source: 'template'
  /** Solo con status 'empty' o 'too_small': guía general, sin análisis. */
  guide: Guide | null
  headline: string | null
  findings: Finding[]
  /** Distribución por familia y por dimensión. `informational`: la estela no emite huecos. */
  families: DistributionRow[]
  dimensions: Array<{
    dimension: Dimension
    label: string
    status: 'ok' | 'insufficient_data'
    informational: boolean
    withData: number
    rows: DistributionRow[]
  }>
  /** Notas de contexto (p. ej. qué significa día/noche). */
  notes: string[]
  suggestions: Array<{
    perfumeId: string
    brand: string
    name: string
    gender: string
    imageUrl: string | null
    covers: string[]
    inWishlist: boolean
    wishlistNote: string | null
  }>
  /** false si hay menos sugerencias que el mínimo: la interfaz avisa que la lista es corta. */
  complete: boolean
}

export function buildGapsResponse(analysis: GapAnalysisInput): GapsResponse {
  const { families, dimensions } = analysis
  const { status, coverage } = families
  const empty: GapsResponse = {
    status,
    coverage,
    source: 'template',
    guide: null,
    headline: null,
    findings: [],
    families: [],
    dimensions: [],
    notes: [],
    suggestions: [],
    complete: false,
  }
  // Sin datos suficientes: solo la guía. No se devuelve ningún análisis, ni siquiera descriptivo.
  if (status !== 'ok') return { ...empty, guide: guideFor(status, coverage.used, coverage.notUsable) }

  const findings: Finding[] = []
  const used = coverage.used
  for (const c of families.gaps) findings.push({ kind: 'gap', area: 'family', code: c.family, label: FAMILY_LABELS[c.family], text: familyGapText(c.family, used, c.catalogShare) })
  for (const d of dimensions.dimensions) {
    for (const c of d.gaps) findings.push({ kind: 'gap', area: d.dimension, code: c.value, label: VALUE_LABELS[d.dimension][c.value] ?? c.value, text: dimensionGapText(d.dimension, c.value, used) })
  }
  for (const c of families.weak) findings.push({ kind: 'weak', area: 'family', code: c.family, label: FAMILY_LABELS[c.family], text: familyWeakText(c.family, c.count, used, c.catalogShare) })
  for (const d of dimensions.dimensions) {
    for (const c of d.weak) findings.push({ kind: 'weak', area: d.dimension, code: c.value, label: VALUE_LABELS[d.dimension][c.value] ?? c.value, text: dimensionWeakText(d.dimension, c.value, c.count, d.withData, c.catalogShare) })
  }
  for (const c of families.unexplored) findings.push({ kind: 'unexplored', area: 'family', code: c.family, label: FAMILY_LABELS[c.family], text: familyUnexploredText(c.family, c.catalogShare) })
  for (const d of dimensions.dimensions) {
    for (const c of d.unexplored) findings.push({ kind: 'unexplored', area: d.dimension, code: c.value, label: VALUE_LABELS[d.dimension][c.value] ?? c.value, text: dimensionUnexploredText(d.dimension, c.value, c.catalogShare) })
  }

  const notes = dimensions.dimensions.filter((d) => d.status === 'insufficient_data').map((d) => insufficientDataText(d.dimension, d.missingShare))
  if (dimensions.dimensions.some((d) => d.dimension === 'dayNight' && d.status === 'ok')) notes.push(DAY_NIGHT_NOTE)

  return {
    ...empty,
    headline: headlineText(used, findings.filter((f) => f.kind === 'gap').length, findings.filter((f) => f.kind === 'weak').length),
    findings,
    families: families.families.map((c) => ({ code: c.family as FamilyCode, label: FAMILY_LABELS[c.family], count: c.count, presence: c.presence, catalogShare: c.catalogShare, level: c.level })),
    dimensions: dimensions.dimensions.map((d) => ({
      dimension: d.dimension,
      label: DIMENSION_LABELS[d.dimension],
      status: d.status,
      informational: !GAP_DIMENSIONS.includes(d.dimension),
      withData: d.withData,
      rows: d.values.map((v) => ({ code: v.value, label: VALUE_LABELS[d.dimension][v.value] ?? v.value, count: v.count, presence: v.presence, catalogShare: v.catalogShare, level: v.level })),
    })),
    notes,
    // El puntaje interno del ranking no sale: la interfaz muestra qué cubre cada candidato, no un número.
    suggestions: analysis.suggestions.map((s) => ({
      perfumeId: s.perfumeId,
      brand: s.brand,
      name: s.name,
      gender: s.gender,
      imageUrl: s.imageUrl,
      covers: s.covers.map(coveredLabel),
      inWishlist: s.inWishlist,
      wishlistNote: s.inWishlist ? WISHLIST_LABEL : null,
    })),
    complete: analysis.complete,
  }
}
