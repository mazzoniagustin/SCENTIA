import { summarizeStreak } from '../streak/streak.ts'

// Resumen anónimo de una cuenta que se elimina (RF-05, ver docs/retencion-eliminacion-cuenta.md). Lógica pura: no toca la base.
// Solo copia una lista cerrada de campos; nunca correo, nombre, apodo, ids de la persona, notas, quiz ni fechas con día u hora.

export const DELETION_POLICY_VERSION = 1

export type CollectionStatusName = 'OWNED' | 'DECANT' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED'

export type DeletionInput = {
  createdAt: Date
  deletedAt: Date
  hasQuizProfile: boolean
  collection: { perfumeId: string; status: CollectionStatusName; rating: number | null }[]
  /** Claves "YYYY-MM-DD" de los días con perfume registrado. */
  wearDays: string[]
}

export type DeletionSummary = {
  signedUpMonth: string
  deletedMonth: string
  collectionTotal: number
  ownedCount: number
  sampledCount: number
  wishlistCount: number
  dislikedCount: number
  ratingsCount: number
  ratingsSum: number
  longestStreak: number
  wearDaysTotal: number
  hadQuizProfile: boolean
  policyVersion: number
  collection: { perfumeId: string; status: CollectionStatusName; rating: number | null }[]
}

const month = (date: Date) => date.toISOString().slice(0, 7)

export function buildDeletionSummary(input: DeletionInput): DeletionSummary {
  const countOf = (status: CollectionStatusName) => input.collection.filter((c) => c.status === status).length
  const rated = input.collection.filter((c) => c.rating !== null)
  // Solo `best` y `total` se usan: no dependen de "hoy".
  const streak = summarizeStreak(input.wearDays, input.deletedAt.toISOString().slice(0, 10))

  return {
    signedUpMonth: month(input.createdAt),
    deletedMonth: month(input.deletedAt),
    collectionTotal: input.collection.length,
    ownedCount: countOf('OWNED'),
    sampledCount: countOf('SAMPLED'),
    wishlistCount: countOf('WISHLIST'),
    dislikedCount: countOf('DISLIKED'),
    ratingsCount: rated.length,
    ratingsSum: rated.reduce((sum, c) => sum + (c.rating as number), 0),
    longestStreak: streak.best,
    wearDaysTotal: streak.total,
    hadQuizProfile: input.hasQuizProfile,
    policyVersion: DELETION_POLICY_VERSION,
    collection: input.collection.map((c) => ({ perfumeId: c.perfumeId, status: c.status, rating: c.rating })),
  }
}
