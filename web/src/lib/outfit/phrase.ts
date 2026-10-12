// Frase de respaldo (sin LLM) de "¿Qué me pongo hoy?". Módulo puro y determinista: mismo clima y
// mismo perfume, misma frase. Español rioplatense, máximo dos oraciones.

import { ACCORD_TRANSLATIONS } from '../../../scripts/accord-translations.ts'
import type { OutfitPick, WeatherProfile } from './types.ts'

function weatherSentence(profile: WeatherProfile): string {
  const { band, humid, wet, isDay } = profile
  if (wet) {
    return isDay ? 'Hoy está lluvioso y conviene un perfume que no se pierda con la humedad' : 'Esta noche llueve, así que te va bien algo que abrigue sin pesar'
  }
  if (band === 'hot') {
    if (humid) return isDay ? 'Hace calor y está pesado, así que hoy conviene algo liviano y fresco' : 'La noche está calurosa y húmeda, mejor algo liviano que no empalague'
    return isDay ? 'Hoy hace calor, ideal para algo fresco' : 'La noche está calurosa, ideal para algo fresco'
  }
  if (band === 'cold') {
    if (humid) return isDay ? 'Hace frío y hay humedad, así que hoy va algo con cuerpo' : 'La noche está fría y húmeda, va algo con cuerpo'
    return isDay ? 'Hoy hace frío, va bien algo cálido y envolvente' : 'Esta noche hace frío, va bien algo cálido y envolvente'
  }
  if (humid) return isDay ? 'El día está templado pero húmedo, mejor algo ligero' : 'La noche está templada y húmeda, mejor algo ligero'
  return isDay ? 'Hoy el clima está agradable y va casi cualquier cosa' : 'La noche está agradable y va casi cualquier cosa'
}

function accordList(accords: string[]): string {
  const names = accords
    .slice(0, 2)
    .map((a) => ACCORD_TRANSLATIONS[a.toLowerCase()] ?? a)
    .filter((a) => a.trim() !== '')
  if (names.length === 0) return ''
  return names.length === 1 ? names[0] : `${names[0]} y ${names[1]}`
}

export function templatePhrase(profile: WeatherProfile, pick: Pick<OutfitPick, 'brand' | 'name' | 'topAccords'>): string {
  const accords = accordList(pick.topAccords)
  const second = accords
    ? `Probá ${pick.name} de ${pick.brand}, con sus notas de ${accords}.`
    : `Probá ${pick.name} de ${pick.brand}.`
  return `${weatherSentence(profile)}. ${second}`
}
