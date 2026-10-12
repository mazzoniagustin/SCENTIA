// Validación y redondeo de coordenadas y de búsquedas de ciudad. Módulo puro.
import type { RoundedCoords } from './types.ts'

/** Redondea a 1 decimal (~10 km) y normaliza -0 a 0. */
export function roundCoord(n: number): number {
  const r = Math.round(n * 10) / 10
  return r === 0 ? 0 : r
}

/** Devuelve las coordenadas redondeadas, o null si no son números finitos dentro de rango. */
export function parseCoords(input: unknown): RoundedCoords | null {
  if (typeof input !== 'object' || input === null) return null
  const { latitude, longitude } = input as Record<string, unknown>
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude: roundCoord(latitude), longitude: roundCoord(longitude) }
}

/** Texto de búsqueda de ciudad: string recortado de 2 a 80 caracteres, sin caracteres de control. */
export function parsePlaceQuery(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const q = input.trim()
  if (q.length < 2 || q.length > 80) return null
  if (/[\u0000-\u001f\u007f-\u009f]/.test(q)) return null
  return q
}
