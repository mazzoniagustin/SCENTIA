// Huecos por estación, día/noche, duración y estela. Puro, igual que analyze.ts y con los mismos criterios
// (hueco, cobertura débil, "no explorado", mínimo de perfumes) vía `classifyCoverage`.
//
// "Ocasión" en la base solo distingue día y noche (se deriva de los votos de día/noche), así que acá y en los
// textos se llama día/noche; no se promete nada sobre trabajo, fiestas, etc.
//
// Datos faltantes: si más de la mitad de los perfumes usables no tiene el dato de una dimensión, esa dimensión
// no emite huecos (`insufficient_data`): no se inventa una conclusión con datos que no hay. Las estaciones se
// infieren de los acordes cuando el perfume no las trae (el catálogo las trae casi siempre).

import { classifyCoverage, summarizeUsable } from './analyze.ts'
import { inferSeasons, SEASONS } from '../seasons.ts'
import type { CollectionSample, FamilyCoverage, ReportStatus } from './types.ts'

/** Si falta el dato en MÁS de esta fracción de los usables, la dimensión no emite huecos (exactamente la mitad sí). */
export const MAX_MISSING_SHARE = 0.5
// Cortes de duración y estela: elegidos el 2026-10-15 mirando los 41.432 perfumes publicados (promedios votados).
//   Duración (1,06 a 3,90; ninguno llega a 4): corta 8,5 %, media 63,6 %, larga 27,9 %.
//   Estela: suave 21,8 %, moderada 75,3 %, fuerte 2,8 %.
// Son criterios editoriales y revisables: si cambia el catálogo (nuevas importaciones) o parecen mal puestos, se
// cambian estas constantes; las frecuencias del catálogo se calculan con los mismos cortes, así que no hay que
// tocar nada más. Con ellos, "corta" y "fuerte" caen bajo el 20 % (no explorado) y la estela no emite huecos.
/** Duración (1-5): menor a esto es corta. */
export const DURATION_SHORT_BELOW = 2.5
/** Duración (1-5): desde esto es larga; entre ambos, media. */
export const DURATION_LONG_FROM = 3.5
/** Estela (1-4): menor a esto es suave. */
export const SILLAGE_SOFT_BELOW = 2
/** Estela (1-4): desde esto es fuerte; entre ambos, moderada. */
export const SILLAGE_STRONG_FROM = 3

export const DIMENSIONS = ['season', 'dayNight', 'duration', 'sillage'] as const
export type Dimension = (typeof DIMENSIONS)[number]

/**
 * Dimensiones que pueden emitir "hueco" (y cobertura débil). La estela es solo informativa: se muestra la
 * distribución de la colección y "no explorado" para la fuerte, pero nunca se la presenta como una carencia.
 */
export const GAP_DIMENSIONS: readonly Dimension[] = ['season', 'dayNight', 'duration']

/** Valores de cada dimensión, en orden fijo de presentación y de desempate. */
export const DIMENSION_VALUES: Readonly<Record<Dimension, readonly string[]>> = {
  season: SEASONS,
  dayNight: ['dia', 'noche'],
  duration: ['corta', 'media', 'larga'],
  sillage: ['suave', 'moderada', 'fuerte'],
}

export const DIMENSION_LABELS: Readonly<Record<Dimension, string>> = {
  season: 'Estación',
  dayNight: 'Día o noche',
  duration: 'Duración',
  sillage: 'Estela',
}

export const VALUE_LABELS: Readonly<Record<Dimension, Readonly<Record<string, string>>>> = {
  season: { primavera: 'Primavera', verano: 'Verano', otoño: 'Otoño', invierno: 'Invierno' },
  dayNight: { dia: 'Día', noche: 'Noche' },
  duration: { corta: 'Duración corta', media: 'Duración media', larga: 'Duración larga' },
  sillage: { suave: 'Estela suave', moderada: 'Estela moderada', fuerte: 'Estela fuerte' },
}

type ProfileInput = Pick<CollectionSample, 'accords' | 'seasons' | 'occasions' | 'longevity' | 'sillage'>

/** Valores de un perfume en cada dimensión; null = sin dato. */
export type DimensionProfile = Record<Dimension, readonly string[] | null>

export type DimensionShares = Readonly<Record<Dimension, Readonly<Record<string, number>>>>

export function durationBand(longevity: number | null | undefined): string | null {
  if (longevity == null || !Number.isFinite(longevity)) return null
  return longevity < DURATION_SHORT_BELOW ? 'corta' : longevity < DURATION_LONG_FROM ? 'media' : 'larga'
}

export function sillageBand(sillage: number | null | undefined): string | null {
  if (sillage == null || !Number.isFinite(sillage)) return null
  return sillage < SILLAGE_SOFT_BELOW ? 'suave' : sillage < SILLAGE_STRONG_FROM ? 'moderada' : 'fuerte'
}

function seasonsOf(input: ProfileInput): readonly string[] | null {
  const known = new Set<string>(SEASONS)
  const stored = (input.seasons ?? []).filter((s) => known.has(s))
  if (stored.length > 0) return stored
  const inferred = inferSeasons(input.accords)
  return inferred.length > 0 ? inferred : null
}

function dayNightOf(input: ProfileInput): readonly string[] | null {
  const found = new Set<string>()
  for (const occasion of input.occasions ?? []) {
    if (occasion === 'diario') found.add('dia')
    else if (occasion === 'noche') found.add('noche')
  }
  return found.size > 0 ? [...found] : null
}

export function profileOf(input: ProfileInput): DimensionProfile {
  const duration = durationBand(input.longevity)
  const sillage = sillageBand(input.sillage)
  return {
    season: seasonsOf(input),
    dayNight: dayNightOf(input),
    duration: duration ? [duration] : null,
    sillage: sillage ? [sillage] : null,
  }
}

export type DimensionCounts = Record<Dimension, { withData: number; counts: Record<string, number> }>

/**
 * Cuántos perfumes del catálogo tienen cada valor, y cuántos tienen dato en esa dimensión (enteros). Referencia
 * pura de la capa de datos: el test que compara el SQL con esta función debe comparar estos conteos enteros,
 * nunca proporciones decimales.
 */
export function catalogDimensionCounts(catalog: readonly ProfileInput[]): DimensionCounts {
  const profiles = catalog.map(profileOf)
  const result = {} as DimensionCounts
  for (const dimension of DIMENSIONS) {
    const withData = profiles.filter((p) => p[dimension] !== null)
    result[dimension] = {
      withData: withData.length,
      counts: Object.fromEntries(DIMENSION_VALUES[dimension].map((value) => [value, withData.filter((p) => p[dimension]!.includes(value)).length])),
    }
  }
  return result
}

/** Frecuencia (0-1) de cada valor sobre los perfumes con dato en esa dimensión. Sin datos, 0. */
export function dimensionSharesFromCounts(counts: DimensionCounts): DimensionShares {
  return Object.fromEntries(
    DIMENSIONS.map((d) => [
      d,
      Object.fromEntries(DIMENSION_VALUES[d].map((v) => [v, counts[d].withData === 0 ? 0 : counts[d].counts[v] / counts[d].withData])),
    ]),
  ) as DimensionShares
}

export function catalogDimensionShares(catalog: readonly ProfileInput[]): DimensionShares {
  return dimensionSharesFromCounts(catalogDimensionCounts(catalog))
}

export type DimensionValueCoverage = Omit<FamilyCoverage, 'family'> & { value: string }

export type DimensionResult = {
  dimension: Dimension
  /** insufficient_data: falta el dato en más de la mitad de los usables; no se emite nada para esta dimensión. */
  status: 'ok' | 'insufficient_data'
  /** Usables con dato en esta dimensión: la base de sus porcentajes. */
  withData: number
  /** Fracción de usables sin dato (0-1). */
  missingShare: number
  /** Vacío si hay datos insuficientes. */
  values: DimensionValueCoverage[]
  gaps: DimensionValueCoverage[]
  weak: DimensionValueCoverage[]
  unexplored: DimensionValueCoverage[]
}

export type DimensionsReport = {
  status: ReportStatus
  coverage: { used: number; skippedWithoutAccords: number; notUsable: number }
  /** Las 4 dimensiones, en el orden de DIMENSIONS. Vacío si status es 'empty'. */
  dimensions: DimensionResult[]
}

function analyzeDimension(
  dimension: Dimension,
  profiles: readonly DimensionProfile[],
  shares: Readonly<Record<string, number>>,
  emitFindings: boolean,
): DimensionResult {
  const used = profiles.length
  const withDataProfiles = profiles.filter((p) => p[dimension] !== null)
  const withData = withDataProfiles.length
  const missingShare = (used - withData) / used
  const result: DimensionResult = { dimension, status: 'ok', withData, missingShare, values: [], gaps: [], weak: [], unexplored: [] }

  if (withData === 0 || missingShare > MAX_MISSING_SHARE) return { ...result, status: 'insufficient_data' }

  const order = DIMENSION_VALUES[dimension]
  const values: DimensionValueCoverage[] = order.map((value) => {
    const count = withDataProfiles.filter((p) => p[dimension]!.includes(value)).length
    const catalogShare = shares[value] ?? 0
    const level = classifyCoverage(count, withData, catalogShare)
    // Dimensión solo informativa: ni hueco ni cobertura débil; sí "no explorado".
    const shown = !GAP_DIMENSIONS.includes(dimension) && (level === 'gap' || level === 'weak') ? 'covered' : level
    return { value, count, presence: count / withData, catalogShare, level: shown }
  })
  if (!emitFindings) return { ...result, values }

  const byOrder = (a: DimensionValueCoverage, b: DimensionValueCoverage) => order.indexOf(a.value) - order.indexOf(b.value)
  const relative = (c: DimensionValueCoverage) => c.presence / c.catalogShare
  return {
    ...result,
    values,
    gaps: values.filter((c) => c.level === 'gap').sort((a, b) => b.catalogShare - a.catalogShare || byOrder(a, b)),
    weak: values.filter((c) => c.level === 'weak').sort((a, b) => relative(a) - relative(b) || byOrder(a, b)),
    unexplored: values.filter((c) => c.level === 'unexplored').sort(byOrder),
  }
}

export function analyzeDimensions(samples: readonly CollectionSample[], shares: DimensionShares): DimensionsReport {
  const { base, coverage, status } = summarizeUsable(samples)
  if (status === 'empty') return { status, coverage, dimensions: [] }
  const profiles = base.map(profileOf)
  return {
    status,
    coverage,
    dimensions: DIMENSIONS.map((d) => analyzeDimension(d, profiles, shares[d] ?? {}, status === 'ok')),
  }
}
