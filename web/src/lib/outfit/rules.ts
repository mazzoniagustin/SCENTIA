// Afinidad de cada acorde con el clima. Los nombres deben existir en `Accord.name`
// (valores de ACCORD_TRANSLATIONS); rules.test.ts lo verifica.
//
// Afinidad ∈ [0, 1] según la banda de temperatura:
//   - 'hot': acordes frescos → 1, acordes densos → 0.
//   - 'cold': acordes cálidos → 1, acordes frescos → 0.
//   - 'mild': neutro, 0.5 para todo (no se favorece nada).
// Los acordes sin afinidad explícita se derivan de ACCORD_SEASONS (calor → verano, frío → invierno/otoño);
// si tampoco están ahí, 0.5.

import { ACCORD_SEASONS } from '../seasons.ts'
import type { TemperatureBand } from './types.ts'

export const HOT_ACCORDS: ReadonlySet<string> = new Set([
  'cítrico', 'fresco', 'acuático', 'marino', 'verde', 'ozónico', 'tropical', 'salado',
  'herbal', 'especiado fresco', 'aromático', 'mineral', 'terpénico',
])

export const COLD_ACCORDS: ReadonlySet<string> = new Set([
  'amaderado', 'ámbar', 'vainilla', 'especiado cálido', 'canela', 'balsámico', 'oud', 'cuero',
  'ahumado', 'tabaco', 'café', 'ron', 'whisky', 'pachuli', 'oriental',
])

/** Acordes dulces y densos que en calor o humedad resultan empalagosos. */
export const CLOYING_ACCORDS: ReadonlySet<string> = new Set([
  'dulce', 'vainilla', 'caramelo', 'miel', 'chocolate', 'cacao', 'almendra', 'lactónico', 'ron',
  'gourmand', 'lácteo', 'cremoso',
])

export const NEUTRAL_AFFINITY = 0.5

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Afinidad derivada de las estaciones: contraste calor (verano) vs frío (invierno/otoño). */
function derivedAffinity(name: string, band: 'hot' | 'cold'): number {
  const seasons = ACCORD_SEASONS[name]
  if (!seasons) return NEUTRAL_AFFINITY
  const summer = seasons.verano ?? 0
  const winter = Math.max(seasons.invierno ?? 0, seasons.otoño ?? 0)
  const delta = band === 'hot' ? summer - winter : winter - summer
  return clamp01(NEUTRAL_AFFINITY + NEUTRAL_AFFINITY * delta)
}

export function accordAffinity(name: string, band: TemperatureBand): number {
  if (band === 'mild') return NEUTRAL_AFFINITY
  const favored = band === 'hot' ? HOT_ACCORDS : COLD_ACCORDS
  const opposed = band === 'hot' ? COLD_ACCORDS : HOT_ACCORDS
  if (favored.has(name)) return 1
  if (opposed.has(name)) return 0
  return derivedAffinity(name, band)
}

export function isCloyingAccord(name: string): boolean {
  return CLOYING_ACCORDS.has(name)
}
