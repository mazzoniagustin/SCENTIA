// Vista pública de una colección compartida.
// Módulo puro: no importa Prisma ni accede a la base. Solo decide qué campos
// de una fila salen hacia una persona que no es dueña de la colección.

export type ShareScope = 'OWNED' | 'WISHLIST'

export type SharedRow = {
  rating: number | null
  perfume: {
    id: string
    brand: string
    name: string
    gender: string
    imageUrl: string | null
  }
}

export type PublicEntry = {
  id: string
  brand: string
  name: string
  gender: string
  imageUrl: string | null
  rating?: number
}

const OWNER_FALLBACK_LABEL = 'Una colección'

export function parseShareScope(value: unknown): ShareScope | null {
  if (value === 'OWNED' || value === 'WISHLIST') return value
  return null
}

// Cada entrada se arma copiando campo por campo (sin spread) para que un campo
// extra de la fila (notas personales, email, etc.) nunca llegue a la salida.
export function toPublicEntries(
  rows: SharedRow[],
  options: { scope: ShareScope; showRatings: boolean },
): PublicEntry[] {
  const includeRatings = options.scope === 'OWNED' && options.showRatings

  return rows.map((row) => {
    const entry: PublicEntry = {
      id: row.perfume.id,
      brand: row.perfume.brand,
      name: row.perfume.name,
      gender: row.perfume.gender,
      imageUrl: row.perfume.imageUrl,
    }
    if (includeRatings && row.rating !== null && row.rating !== undefined) {
      entry.rating = row.rating
    }
    return entry
  })
}

export function shareOwnerLabel(nickname: string | null | undefined): string {
  const trimmed = nickname?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : OWNER_FALLBACK_LABEL
}
