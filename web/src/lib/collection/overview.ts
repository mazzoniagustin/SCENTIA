// Vista de "Mi colección": etiquetas de estado, conteos y filtro por estado (la URL manda). Lógica pura.

export type CollectionStatusValue = 'OWNED' | 'DECANT' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED'

/** Orden de las pestañas y de las etiquetas (las mismas del formulario de la colección). */
export const STATUS_ORDER: readonly CollectionStatusValue[] = ['OWNED', 'DECANT', 'SAMPLED', 'WISHLIST', 'DISLIKED']

export const STATUS_LABELS: Record<CollectionStatusValue, string> = {
  OWNED: 'Lo tengo',
  DECANT: 'Tengo un decant',
  SAMPLED: 'Probé una muestra',
  WISHLIST: 'Lo quiero',
  DISLIKED: 'No me gustó',
}

/** Lee `?estado=` de la URL. Cualquier cosa que no sea un estado exacto se ignora (muestra todo). */
export function parseStatusFilter(value: string | string[] | undefined): CollectionStatusValue | null {
  const single = Array.isArray(value) ? value[0] : value
  return STATUS_ORDER.find((status) => status === single) ?? null
}

export function countByStatus(entries: ReadonlyArray<{ status: string }>): Record<CollectionStatusValue, number> {
  const counts: Record<CollectionStatusValue, number> = { OWNED: 0, DECANT: 0, SAMPLED: 0, WISHLIST: 0, DISLIKED: 0 }
  for (const entry of entries) {
    if (entry.status in counts) counts[entry.status as CollectionStatusValue] += 1
  }
  return counts
}

export function filterByStatus<T extends { status: string }>(entries: readonly T[], status: CollectionStatusValue | null): T[] {
  return status ? entries.filter((entry) => entry.status === status) : [...entries]
}

/** "4 de 5" para mostrar y leer; null si no hay puntuación. */
export function ratingLabel(rating: number | null | undefined): string | null {
  return rating ? `${rating} de 5` : null
}
