// Motor de similitud entre perfumes (ADR-007: determinista, explicable, sin IA).
//
// Puntaje de similitud entre un perfume de referencia (base) y un candidato,
// según el diseño aprobado del motor de recomendaciones:
//   - Acordes: intersección ponderada por intensidad (mínimo entre ambos).
//   - Notas: intersección ponderada por fase (base=3, heart=2, top=1).
//   - score = 0.6 * accordScore + 0.4 * noteScore
//
// Estados de colección: 'owned' y 'disliked' excluyen al candidato (puntaje 0).
// 'disliked' todavía no existe en el schema (Fase 3); se anticipa aquí para que
// el vocabulario sea cerrado desde ahora y no requiera cambios en esta función.

/** Fases olfativas reconocidas por el motor. */
export type NoteType = 'top' | 'heart' | 'base'

/** Vocabulario controlado de estados de colección (anticipa 'disliked' de Fase 3). */
export type CollectionStatus = 'owned' | 'sampled' | 'wishlist' | 'disliked'

/** Relación perfume-acorde con solo los campos que intervienen en el puntaje. */
export type AccordRelation = {
  accordId: string
  intensity: number
}

/** Relación perfume-nota con solo los campos que intervienen en el puntaje. */
export type NoteRelation = {
  noteId: string
  noteType: string
}

/**
 * Perfume con relaciones cargadas. Tipo estructural mínimo: acepta cualquier
 * payload de Prisma con `include: { accords, notes }` sin acoplar este módulo
 * al cliente generado.
 */
export type PerfumeWithRelations = {
  id: string
  accords?: ReadonlyArray<AccordRelation> | null
  notes?: ReadonlyArray<NoteRelation> | null
}

/** Entrada de colección con solo los campos que intervienen en el puntaje. */
export type UserCollectionEntry = {
  perfumeId: string
  status: string
}

/** Pesos por fase: la base define la firma del perfume, el top es volátil. */
export const NOTE_TYPE_WEIGHTS: Readonly<Record<NoteType, number>> = {
  base: 3,
  heart: 2,
  top: 1,
}

/** Peso relativo de cada dimensión dentro del bucket de similitud olfativa. */
export const W_ACCORDS = 0.6
export const W_NOTES = 0.4

/** Estados que excluyen al candidato del ranking (penalización total). */
export const EXCLUDED_STATUSES: ReadonlySet<string> = new Set(['owned', 'disliked'])

/** Peso de una fase; las fases desconocidas no contribuyen al puntaje. */
function noteWeight(noteType: string): number {
  return noteType === 'base' || noteType === 'heart' || noteType === 'top'
    ? NOTE_TYPE_WEIGHTS[noteType]
    : 0
}

/**
 * Similitud de acordes: masa de intensidad compartida sobre la masa total de
 * la base. Por cada acorde compartido se toma el mínimo de intensidades, para
 * que la coincidencia no sobre-reporte cuando un lado lo tiene apenas presente.
 */
function accordScore(
  baseAccords: ReadonlyArray<AccordRelation>,
  candidateAccords: ReadonlyMap<string, number>,
): number {
  let total = 0
  let shared = 0
  for (const accord of baseAccords) {
    total += accord.intensity
    const candidateIntensity = candidateAccords.get(accord.accordId)
    if (candidateIntensity !== undefined) {
      shared += Math.min(accord.intensity, candidateIntensity)
    }
  }
  // Sin acordes en la base (o intensidades no positivas) no hay base de
  // comparación: 0 en lugar de NaN.
  return total > 0 ? shared / total : 0
}

/**
 * Similitud de notas: masa de peso de fase compartida sobre la masa total de
 * la base. El peso se toma siempre de la fila de la base (referencia), para
 * que numerador y denominador sean consistentes entre sí.
 */
function noteScore(
  baseNotes: ReadonlyArray<NoteRelation>,
  candidateNoteIds: ReadonlySet<string>,
): number {
  let total = 0
  let shared = 0
  for (const note of baseNotes) {
    const weight = noteWeight(note.noteType)
    total += weight
    if (candidateNoteIds.has(note.noteId)) {
      shared += weight
    }
  }
  // Sin notas ponderables en la base no hay base de comparación: 0, no NaN.
  return total > 0 ? shared / total : 0
}

/**
 * Puntaje de similitud [0, 1] entre `base` (perfume de referencia) y
 * `candidate`. Devuelve 0 — sin lanzar excepciones — cuando:
 *   - el candidato está en la colección con estado 'owned' o 'disliked';
 *   - la base no tiene acordes ni notas para comparar;
 *   - las relaciones no fueron cargadas (include de Prisma ausente).
 */
export function calculateSimilarityScore(
  base: PerfumeWithRelations,
  candidate: PerfumeWithRelations,
  userCollection?: ReadonlyArray<UserCollectionEntry>,
): number {
  // Exclusión dura: los estados excluidos prevalecen sobre cualquier puntaje.
  const isExcluded =
    userCollection?.some(
      (entry) =>
        entry.perfumeId === candidate.id && EXCLUDED_STATUSES.has(entry.status),
    ) ?? false
  if (isExcluded) return 0

  const baseAccords = base.accords ?? []
  const baseNotes = base.notes ?? []
  if (baseAccords.length === 0 && baseNotes.length === 0) return 0

  const candidateAccords = new Map(
    (candidate.accords ?? []).map((accord) => [accord.accordId, accord.intensity]),
  )
  const candidateNoteIds = new Set((candidate.notes ?? []).map((note) => note.noteId))

  return (
    W_ACCORDS * accordScore(baseAccords, candidateAccords) +
    W_NOTES * noteScore(baseNotes, candidateNoteIds)
  )
}
