import type { Prisma } from '@prisma/client'

// Valores de orden aceptados. 'relevance' es la popularidad: la cantidad de votos que tiene el perfume en la fuente de datos
// (`ratingCount`), de modo que el catálogo abre con lo más conocido en vez de con las marcas por orden alfabético.
export const SORT_VALUES = ['relevance', 'newest', 'duration-desc', 'duration-asc', 'longevity-desc'] as const
export type SortValue = (typeof SORT_VALUES)[number]

// Tie-break determinista: brand/name asc detrás del criterio principal (el par es único en el catálogo).
export const SORT_ORDER: Record<SortValue, Prisma.PerfumeOrderByWithRelationInput[]> = {
  relevance: [{ ratingCount: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  newest: [{ releaseYear: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  'duration-desc': [{ duration: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  'duration-asc': [{ duration: { sort: 'asc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  // Duración votada por la comunidad (1-5), la que traen los perfumes importados del dataset de Kaggle.
  'longevity-desc': [{ longevity: { sort: 'desc', nulls: 'last' } }, { ratingCount: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
}

export function parseSort(value: string | null): SortValue | null {
  if (value === null || value === '') {
    // Sin sort explícito se ordena por relevancia (popularidad).
    return 'relevance'
  }
  return SORT_VALUES.includes(value as SortValue) ? (value as SortValue) : null
}
