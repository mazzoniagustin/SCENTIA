// Contrato de "¿Qué me pongo hoy?". Módulo puro: solo tipos y constantes.

import type { Weather } from '../weather/types.ts'

export type TemperatureBand = 'cold' | 'mild' | 'hot'

/** Resumen del clima que usan las reglas, la frase y la UI. */
export type WeatherProfile = {
  band: TemperatureBand
  humid: boolean
  wet: boolean
  isDay: boolean
  temperatureC: number
  apparentTemperatureC: number
  humidityPct: number
  precipitationMm: number
}

export type OutfitStatus = 'OWNED' | 'DECANT' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED'

/** Perfume de la colección tal como lo necesita el motor (sin Prisma). */
export type OutfitCandidate = {
  perfumeId: string
  brand: string
  name: string
  imageUrl: string | null
  slug: string | null
  status: OutfitStatus
  rating: number | null
  accords: ReadonlyArray<{ name: string; intensity: number }>
  /** Estela votada por la comunidad (1-4); null o ausente si no hay. Solo se usa con un contexto (ADR-011). */
  sillage?: number | null
  /** Perfume que cargó la persona (no es del catálogo): su marca y nombre son texto libre y no salen hacia terceros. */
  own?: boolean
}

export type ReasonCode =
  | 'fresh_for_heat'
  | 'warm_for_cold'
  | 'light_for_humidity'
  | 'avoids_cloying'
  | 'owned'
  | 'discreet_for_context'
  | 'light_for_context'
  | 'strong_for_context'
  | 'intense_for_context'

export type OutfitPick = {
  perfumeId: string
  brand: string
  name: string
  imageUrl: string | null
  slug: string | null
  status: 'OWNED' | 'DECANT' | 'SAMPLED'
  score: number
  topAccords: string[]
  reasons: ReasonCode[]
  /** Viene de `OutfitCandidate.own`; ausente en los del catálogo. */
  own?: boolean
}

export type OutfitResult =
  | { status: 'ok'; primary: OutfitPick; alternatives: OutfitPick[]; skippedWithoutAccords: number }
  | { status: 'empty_collection' }
  | { status: 'no_wearable' }
  | { status: 'no_accords' }

export type OutfitPhrase = { text: string; source: 'template' | 'llm' }

export type { Weather }
