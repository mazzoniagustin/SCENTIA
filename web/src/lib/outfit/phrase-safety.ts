// Seguridad de la frase generada por LLM. Módulo puro. Solo sale hacia el proveedor el clima resumido
// y los datos públicos del perfume elegido; nunca datos de la persona (id, email, coordenadas,
// ciudad, colección, rating, estado ni alternativas).

import { ACCORD_TRANSLATIONS } from '../../../scripts/accord-translations.ts'
import type { OutfitPick, WeatherProfile } from './types.ts'

const BAND_LABEL = { cold: 'frío', mild: 'templado', hot: 'calor' } as const

/** Deja solo letras, números, espacios y - . ' & ; (sin saltos de línea ni <>), y acota el largo. */
export function sanitizePromptField(s: string, max = 60): string {
  return String(s ?? '')
    .replace(/[^\p{L}\p{N} \-.'&;]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

/** Acordes del perfume que pertenecen al vocabulario conocido, hasta 3, ya saneados. */
function knownAccords(accords: readonly string[]): string[] {
  const out: string[] = []
  for (const a of accords) {
    const key = String(a).trim().toLowerCase()
    if (Object.hasOwn(ACCORD_TRANSLATIONS, key) && !out.includes(key)) out.push(key)
    if (out.length === 3) break
  }
  return out
}

/** Texto que va dentro de `<datos>`: clima resumido y perfume elegido, nada más. */
export function buildPromptData(
  profile: WeatherProfile,
  pick: Pick<OutfitPick, 'brand' | 'name' | 'topAccords' | 'own'>,
): string {
  const accords = knownAccords(pick.topAccords)
  return [
    `clima: ${BAND_LABEL[profile.band]}`,
    `humedad alta: ${profile.humid ? 'sí' : 'no'}`,
    `lluvia: ${profile.wet ? 'sí' : 'no'}`,
    `momento: ${profile.isDay ? 'día' : 'noche'}`,
    `temperatura aparente: ${Math.round(profile.apparentTemperatureC)} grados`,
    // La marca y el nombre de un perfume propio los escribió la persona: no salen hacia el proveedor.
    `marca: ${pick.own ? 'propia' : sanitizePromptField(pick.brand)}`,
    `perfume: ${pick.own ? 'propio' : sanitizePromptField(pick.name)}`,
    `acordes: ${accords.join(', ') || 'sin datos'}`,
  ].join('\n')
}

const MAX_PHRASE_CHARS = 160
const URL_PATTERN = /https?:|www\.|:\/\/|\b[\w-]+\.(com|net|org|io|app|dev|ar|co|me|xyz|info|ly)\b/i

/** Devuelve el texto recortado si es una frase aceptable; null si hay que descartarla. */
export function validatePhrase(text: string): string | null {
  if (typeof text !== 'string') return null
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean === '' || clean.length > MAX_PHRASE_CHARS) return null
  if (/[@<>]/.test(clean) || URL_PATTERN.test(clean)) return null
  const sentences = clean.split(/[.!?¡¿…]+(?:\s+|$)/).filter((s) => /[\p{L}\p{N}]/u.test(s))
  if (sentences.length === 0 || sentences.length > 2) return null
  return clean
}
