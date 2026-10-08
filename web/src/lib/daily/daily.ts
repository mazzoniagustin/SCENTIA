// Lógica pura del "perfume del día": estación según fecha y hemisferio, clave del día y elección
// determinista. Sin base de datos ni red, para poder probarla. Sin IA: misma fecha → mismo resultado.

import type { Season } from '../seasons.ts'

export type Hemisphere = 'north' | 'south'

/** Zona horaria en la que cambia el día. La persona propietaria está en Argentina. */
export const DAILY_TIMEZONE = 'America/Argentina/Buenos_Aires'
/** Hemisferio por defecto cuando la persona no indicó su país (ubicación de quien mantiene el proyecto). */
export const DEFAULT_HEMISPHERE: Hemisphere = 'south'

// Países (ISO-2) del hemisferio sur. Brasil, Perú, Ecuador, etc. cruzan el ecuador o tienen estaciones
// poco marcadas; se toma el hemisferio donde vive la mayor parte de la población.
const SOUTHERN_COUNTRIES = new Set([
  'AR', 'CL', 'UY', 'PY', 'BO', 'PE', 'BR', 'AU', 'NZ', 'ZA', 'NA', 'BW', 'ZW', 'ZM', 'MZ', 'MG', 'AO',
])

export function hemisphereForCountry(country: string | null | undefined): Hemisphere {
  if (!country) return DEFAULT_HEMISPHERE
  return SOUTHERN_COUNTRIES.has(country.toUpperCase()) ? 'south' : 'north'
}

// Estaciones meteorológicas del hemisferio norte por mes (1-12).
const NORTH_SEASON_BY_MONTH: ReadonlyArray<Season> = [
  'invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano',
  'verano', 'verano', 'otoño', 'otoño', 'otoño', 'invierno',
]
const OPPOSITE: Record<Season, Season> = {
  invierno: 'verano', verano: 'invierno', primavera: 'otoño', otoño: 'primavera',
}

/** Mes (1-12) y día "YYYY-MM-DD" de una fecha en la zona horaria indicada. */
function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {})
  return { month: Number(parts.month), key: `${parts.year}-${parts.month}-${parts.day}` }
}

/** Clave del día ("2026-10-08") en la zona horaria dada; cambia a medianoche local. */
export const dayKey = (date: Date, timeZone: string = DAILY_TIMEZONE) => localParts(date, timeZone).key

export function seasonFor(date: Date, hemisphere: Hemisphere, timeZone: string = DAILY_TIMEZONE): Season {
  const northern = NORTH_SEASON_BY_MONTH[localParts(date, timeZone).month - 1]
  return hemisphere === 'north' ? northern : OPPOSITE[northern]
}

/** Hash FNV-1a de 32 bits: simple, estable entre procesos y plataformas. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Índice determinista en [0, length) para una clave; -1 si no hay elementos. */
export function pickIndex(key: string, length: number): number {
  return length > 0 ? hashString(key) % length : -1
}
