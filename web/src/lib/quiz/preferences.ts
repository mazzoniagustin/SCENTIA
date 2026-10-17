// Preferencias del quiz que no son acordes: estación, momento del día, duración y estela. Puro y determinista.
//
// Se aplican como un ajuste suave del puntaje (`applyPreferences`), nunca como filtro: un perfume sin el dato no se descarta.
// Por cada preferencia activa: coincide = 1, no coincide = 0, sin dato = 0,5 (neutral). El puntaje se mezcla con el promedio como la
// popularidad (`score × (1 − w + w·promedio)`), así que lo peor que puede pasar es perder un `PREFERENCE_WEIGHT` del puntaje.

import { durationBand, sillageBand } from '../gaps/dimensions.ts'
import type { QuizAnswers } from './questions.ts'

/** Cuánto del puntaje depende de las preferencias (0 = no influyen). */
export const PREFERENCE_WEIGHT = 0.25

export type Preferences = {
  /** Estaciones que le sirven (la elección "primavera u otoño" son dos). Vacío: sin preferencia. */
  seasons: string[]
  /** 'diario' (día) o 'noche', como los guarda la base. */
  occasion: 'diario' | 'noche' | null
  duration: 'larga' | 'corta' | null
  sillage: 'suave' | 'fuerte' | null
}

export type PreferenceTarget = {
  seasons?: readonly string[]
  occasions?: readonly string[]
  longevity?: number | null
  sillage?: number | null
}

const SEASON_BY_ANSWER: Readonly<Record<string, string[]>> = {
  verano: ['verano'],
  invierno: ['invierno'],
  entretiempo: ['primavera', 'otoño'],
}

const OCCASION_BY_ANSWER: Readonly<Record<string, 'diario' | 'noche'>> = {
  diario: 'diario',
  deporte: 'diario',
  cita: 'noche',
}

export function preferencesFromAnswers(answers: Pick<QuizAnswers, 'estacion' | 'ocasion' | 'duracion' | 'estela'>): Preferences {
  return {
    seasons: SEASON_BY_ANSWER[answers.estacion] ?? [],
    occasion: OCCASION_BY_ANSWER[answers.ocasion] ?? null,
    duration: answers.duracion === 'larga' ? 'larga' : answers.duracion === 'ligera' ? 'corta' : null,
    sillage: answers.estela === 'discreta' ? 'suave' : answers.estela === 'notoria' ? 'fuerte' : null,
  }
}

/** Qué tan bien cumple el perfume las preferencias activas (0-1), y cuáles cumple. Sin preferencias activas: promedio 1 y nada que cumplir. */
export function preferenceMatch(preferences: Preferences, target: PreferenceTarget): { average: number; matched: PreferenceKey[]; active: number } {
  const checks: Array<[PreferenceKey, number | null]> = []

  if (preferences.seasons.length > 0) {
    const seasons = target.seasons ?? []
    checks.push(['season', seasons.length === 0 ? null : preferences.seasons.some((s) => seasons.includes(s)) ? 1 : 0])
  }
  if (preferences.occasion) {
    const occasions = target.occasions ?? []
    checks.push(['occasion', occasions.length === 0 ? null : occasions.includes(preferences.occasion) ? 1 : 0])
  }
  if (preferences.duration) {
    const band = durationBand(target.longevity)
    checks.push(['duration', band === null ? null : preferences.duration === 'larga' ? (band === 'larga' ? 1 : 0) : band === 'larga' ? 0 : 1])
  }
  if (preferences.sillage) {
    const band = sillageBand(target.sillage)
    checks.push(['sillage', band === null ? null : preferences.sillage === 'fuerte' ? (band === 'fuerte' ? 1 : 0) : band === 'suave' ? 1 : 0])
  }

  if (checks.length === 0) return { average: 1, matched: [], active: 0 }
  const values = checks.map(([, value]) => value ?? 0.5)
  return {
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    matched: checks.filter(([, value]) => value === 1).map(([key]) => key),
    active: checks.length,
  }
}

export type PreferenceKey = 'season' | 'occasion' | 'duration' | 'sillage'

/** Ajusta el puntaje con las preferencias. Sin preferencias activas devuelve el puntaje tal cual. */
export function applyPreferences(score: number, average: number, weight: number = PREFERENCE_WEIGHT): number {
  return score * (1 - weight + weight * Math.min(Math.max(average, 0), 1))
}
