// Validación de lo que llega a las Server Actions de la colección. Las Server Actions son endpoints
// públicos: los tipos de TypeScript no existen en tiempo de ejecución, así que se valida todo acá.

export const COLLECTION_STATUSES = ['OWNED', 'SAMPLED', 'WISHLIST', 'DISLIKED'] as const
export type CollectionStatusValue = (typeof COLLECTION_STATUSES)[number]

export const MAX_NOTES_LENGTH = 2000
const MAX_ID_LENGTH = 64

export type CollectionEntryInput = {
  perfumeId: string
  status: CollectionStatusValue
  rating?: number
  personalNotes?: string
}

export type CollectionValidation = { ok: true; value: CollectionEntryInput } | { ok: false; error: string }

export function isValidPerfumeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

export function validateCollectionEntry(input: unknown): CollectionValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'datos inválidos' }
  }
  const raw = input as Record<string, unknown>

  if (!isValidPerfumeId(raw.perfumeId)) return { ok: false, error: 'perfumeId inválido' }

  if (!(COLLECTION_STATUSES as readonly unknown[]).includes(raw.status)) {
    return { ok: false, error: `status debe ser uno de: ${COLLECTION_STATUSES.join(', ')}` }
  }

  let rating: number | undefined
  if (raw.rating !== undefined && raw.rating !== null) {
    if (typeof raw.rating !== 'number' || !Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5) {
      return { ok: false, error: 'Rating debe ser un entero entre 1 y 5' }
    }
    rating = raw.rating
  }

  let personalNotes: string | undefined
  if (raw.personalNotes !== undefined && raw.personalNotes !== null) {
    if (typeof raw.personalNotes !== 'string' || raw.personalNotes.length > MAX_NOTES_LENGTH) {
      return { ok: false, error: `Las notas admiten hasta ${MAX_NOTES_LENGTH} caracteres` }
    }
    personalNotes = raw.personalNotes
  }

  return {
    ok: true,
    value: { perfumeId: raw.perfumeId, status: raw.status as CollectionStatusValue, rating, personalNotes },
  }
}
