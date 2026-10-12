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

export type OutfitStatus = 'OWNED' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED'

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
}

export type ReasonCode = 'fresh_for_heat' | 'warm_for_cold' | 'light_for_humidity' | 'avoids_cloying' | 'owned'

export type OutfitPick = {
  perfumeId: string
  brand: string
  name: string
  imageUrl: string | null
  slug: string | null
  status: 'OWNED' | 'SAMPLED'
  score: number
  topAccords: string[]
  reasons: ReasonCode[]
}

export type OutfitResult =
  | { status: 'ok'; primary: OutfitPick; alternatives: OutfitPick[]; skippedWithoutAccords: number }
  | { status: 'empty_collection' }
  | { status: 'no_wearable' }
  | { status: 'no_accords' }

export type OutfitPhrase = { text: string; source: 'template' | 'llm' }

export type { Weather }
