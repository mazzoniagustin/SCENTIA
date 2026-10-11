// Chips de filtros activos del catálogo: cada uno lleva un enlace real que quita solo ese filtro.
// Función pura (sin JS en el cliente): el catálogo es un formulario GET y los chips son enlaces.

export type ActiveFilter = { key: string; label: string; removeHref: string }

type Params = Record<string, string | string[] | undefined>

const CONCENTRATION_LABELS: Record<string, string> = { parfum: 'Parfum', edp: 'EDP', edt: 'EDT', edc: 'EDC' }
const PRICE_TIER_LABELS: Record<string, string> = { ARABIC: 'Árabe', DESIGNER: 'Diseñador', NICHE: 'Nicho' }
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
  { key: 'priceTier', label: (v) => `Categoría: ${fromMap(PRICE_TIER_LABELS)(v)}` },
  { key: 'concentration', label: (v) => `Concentración: ${fromMap(CONCENTRATION_LABELS)(v)}` },
  { key: 'gender', label: (v) => `Género: ${capitalize(v)}` },
  { key: 'season', label: (v) => `Estación: ${capitalize(v)}` },
  { key: 'occasion', label: (v) => `Ocasión: ${capitalize(v)}` },
  { key: 'minLongevity', label: (v) => `Duración: ${fromMap(LONGEVITY_LABELS)(v)}` },
  { key: 'minDuration', label: (v) => `Duración mínima: ${v} h` },
  { key: 'maxDuration', label: (v) => `Duración máxima: ${v} h` },
  { key: 'sort', label: (v) => `Orden: ${fromMap(SORT_LABELS)(v)}` },
]

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

export function buildActiveFilters(params: Params, basePath = '/perfumes'): ActiveFilter[] {
  const active = FILTERS.filter((f) => single(params[f.key]) !== '')

  return active.map((filter) => {
    // Al quitar un filtro cambia el conjunto de resultados: la página vuelve a la primera.
    const query = new URLSearchParams()
    for (const other of active) {
      if (other.key !== filter.key) query.set(other.key, single(params[other.key]))
    }
    const qs = query.toString()
    return {
      key: filter.key,
      label: filter.label(single(params[filter.key])),
      removeHref: qs ? `${basePath}?${qs}` : basePath,
    }
  })
}
