// Chips de filtros activos del catálogo: cada uno lleva un enlace real que quita solo ese filtro.
// Función pura (sin JS en el cliente): el catálogo es un formulario GET y los chips son enlaces.

export type ActiveFilter = { key: string; label: string; removeHref: string }

import { GENDER_LABELS, SEASON_LABELS, normalizeGender, normalizeSeason } from './filter-labels.ts'

type Params = Record<string, string | string[] | undefined>

const CONCENTRATION_LABELS: Record<string, string> = { parfum: 'Parfum', edp: 'EDP', edt: 'EDT', edc: 'EDC' }
const SORT_LABELS: Record<string, string> = {
  relevance: 'Relevancia',
  newest: 'Más nuevos',
  'longevity-desc': 'Mayor duración',
  'duration-desc': 'Mayor duración (horas)',
  'duration-asc': 'Menor duración (horas)',
}
const LONGEVITY_LABELS: Record<string, string> = {
  '3': 'Moderada o más',
  '3.5': 'Larga o más',
  '4': 'Muy larga',
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const fromMap = (map: Record<string, string>) => (value: string) => map[value] ?? capitalize(value)

/** Orden en que se muestran los chips (el mismo del formulario, con la búsqueda primero). */
const FILTERS: ReadonlyArray<{ key: string; label: (value: string) => string }> = [
  { key: 'q', label: (v) => `Búsqueda: «${v}»` },
  { key: 'brand', label: (v) => `Marca: ${v}` },
  { key: 'accord', label: (v) => `Acorde: ${capitalize(v)}` },
  { key: 'concentration', label: (v) => `Concentración: ${fromMap(CONCENTRATION_LABELS)(v)}` },
  { key: 'gender', label: (v) => fromMap(GENDER_LABELS)(v) },
  { key: 'season', label: (v) => `Estación: ${fromMap(SEASON_LABELS)(v)}` },
  { key: 'occasion', label: (v) => `Ocasión: ${capitalize(v)}` },
  { key: 'minLongevity', label: (v) => `Duración: ${fromMap(LONGEVITY_LABELS)(v)}` },
  { key: 'minDuration', label: (v) => `Duración mínima: ${v} h` },
  { key: 'maxDuration', label: (v) => `Duración máxima: ${v} h` },
  { key: 'sort', label: (v) => `Orden: ${fromMap(SORT_LABELS)(v)}` },
]

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/** Valor del parámetro en su forma canónica: los alias de género y estación (men, Verano) se llevan al valor guardado. */
function canonical(key: string, params: Params): string {
  const value = single(params[key])
  if (key === 'gender') return normalizeGender(value) ?? value
  if (key === 'season') return normalizeSeason(value) ?? value
  return value
}

export function buildActiveFilters(params: Params, basePath = '/perfumes'): ActiveFilter[] {
  const active = FILTERS.filter((f) => canonical(f.key, params) !== '')

  return active.map((filter) => {
    // Al quitar un filtro cambia el conjunto de resultados: la página vuelve a la primera.
    const query = new URLSearchParams()
    for (const other of active) {
      if (other.key !== filter.key) query.set(other.key, canonical(other.key, params))
    }
    const qs = query.toString()
    return {
      key: filter.key,
      label: filter.label(canonical(filter.key, params)),
      removeHref: qs ? `${basePath}?${qs}` : basePath,
    }
  })
}

export type QuerySuggestion = { words: string[]; href: string }

// Palabras de la búsqueda que en realidad son filtros de género o estación.
const WORD_FILTERS: Record<string, { key: 'gender' | 'season'; value: string }> = {
  hombre: { key: 'gender', value: 'masculino' },
  hombres: { key: 'gender', value: 'masculino' },
  men: { key: 'gender', value: 'masculino' },
  mujer: { key: 'gender', value: 'femenino' },
  mujeres: { key: 'gender', value: 'femenino' },
  women: { key: 'gender', value: 'femenino' },
  unisex: { key: 'gender', value: 'unisex' },
  verano: { key: 'season', value: 'verano' },
  invierno: { key: 'season', value: 'invierno' },
  otoño: { key: 'season', value: 'otoño' },
  primavera: { key: 'season', value: 'primavera' },
}

/**
 * Si la búsqueda trae palabras como "hombres" o "verano", propone aplicarlas como filtros y dejar el resto en `q`.
 * Devuelve null si no hay ninguna, o si el filtro correspondiente ya está aplicado (no pisa lo que eligió la persona).
 */
export function suggestFiltersFromQuery(params: Params, basePath = '/perfumes'): QuerySuggestion | null {
  const q = single(params.q).trim()
  if (!q) return null
  const applied: Partial<Record<'gender' | 'season', string>> = {}
  const words: string[] = []
  const rest: string[] = []
  for (const word of q.split(/\s+/)) {
    const match = WORD_FILTERS[word.toLowerCase()]
    if (match && !canonical(match.key, params) && !applied[match.key]) {
      applied[match.key] = match.value
      words.push(word)
    } else {
      rest.push(word)
    }
  }
  if (words.length === 0) return null

  const query = new URLSearchParams()
  for (const filter of FILTERS) {
    if (filter.key === 'q') {
      if (rest.length > 0) query.set('q', rest.join(' '))
    } else if (applied[filter.key as 'gender' | 'season']) {
      query.set(filter.key, applied[filter.key as 'gender' | 'season']!)
    } else if (canonical(filter.key, params) !== '') {
      query.set(filter.key, canonical(filter.key, params))
    }
  }
  const qs = query.toString()
  return { words, href: qs ? `${basePath}?${qs}` : basePath }
}
