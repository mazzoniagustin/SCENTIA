// Contrato del análisis de huecos de la colección. Solo tipos: sin I/O ni dependencias.

import type { FamilyCode } from './families.ts'

export type CollectionStatus = 'OWNED' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED'

export type SampleAccord = { name: string; intensity: number }

/** Un perfume de la colección tal como lo necesita el análisis. Nunca incluye notas privadas ni datos de la persona. */
export type CollectionSample = {
  perfumeId: string
  status: CollectionStatus
  accords: SampleAccord[]
  /** Estaciones del perfume ('primavera' | 'verano' | 'otoño' | 'invierno'). Vacío o ausente: se infieren de los acordes. */
  seasons?: readonly string[]
  /** 'diario' (día) y 'noche', como los guarda la base. Vacío o ausente: sin dato. Otros valores se ignoran. */
  occasions?: readonly string[]
  /** 'masculino' | 'femenino' | 'unisex' (como lo guarda la base). Solo sirve para deducir el género de las sugerencias. */
  gender?: string | null
  /** Duración promedio votada (1-5). null o ausente: sin dato. */
  longevity?: number | null
  /** Estela promedio votada (1-4). null o ausente: sin dato. */
  sillage?: number | null
}

/** Parte del catálogo que tiene cada familia (0-1). Lo calcula la capa de datos con `catalogFamilyShares`. */
export type CatalogShares = Readonly<Record<FamilyCode, number>>

/**
 * - gap: familia común del catálogo y ninguno de tus perfumes la tiene.
 * - weak: la tenés, pero con mucha menos presencia que en el catálogo (solo con colección suficiente).
 * - unexplored: familia poco frecuente del catálogo que no tenés. Nunca es un hueco.
 * - covered: sin observaciones.
 */
export type FamilyLevel = 'gap' | 'weak' | 'unexplored' | 'covered'

export type FamilyCoverage = {
  family: FamilyCode
  /** Perfumes usables con al menos un acorde de la familia (intensidad >= mínimo de presencia). */
  count: number
  /** count / perfumes usables con acordes. */
  presence: number
  catalogShare: number
  level: FamilyLevel
}

/**
 * - empty: ningún perfume usable (Lo tengo / Probado) con acordes.
 * - too_small: menos del mínimo; se describe pero no se hablan de huecos.
 * - ok: hay datos suficientes.
 */
export type ReportStatus = 'empty' | 'too_small' | 'ok'

export type FamilyReport = {
  status: ReportStatus
  coverage: {
    /** Perfumes usables (OWNED/SAMPLED) con acordes: la base de todos los cálculos. */
    used: number
    /** Usables que no se pudieron analizar por no tener ningún acorde. */
    skippedWithoutAccords: number
    /** Entradas WISHLIST/DISLIKED: no cuentan como cobertura. */
    notUsable: number
  }
  /** Siempre las 10 familias, en el orden de FAMILY_ORDER. Vacío si status es 'empty'. */
  families: FamilyCoverage[]
  /** Solo con status 'ok'. De mayor a menor frecuencia en el catálogo. */
  gaps: FamilyCoverage[]
  /** Solo con status 'ok'. De menor a mayor cobertura relativa. */
  weak: FamilyCoverage[]
  /** Solo con status 'ok'. */
  unexplored: FamilyCoverage[]
}
