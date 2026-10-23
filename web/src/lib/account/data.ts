import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateAnswers } from '@/lib/quiz/profile'
import { QUIZ_COMPATIBLE_FROM, QUIZ_VERSION, type QuizAnswers } from '@/lib/quiz/questions'
import { buildDeletionSummary } from './deletion-summary'
import type { Preferences } from './preferences'

// Datos personales por usuario (cuid de la tabla User): perfil del quiz, preferencias,
// exportación y eliminación (RF-05). Cada función recibe el `userId` de la sesión del
// servidor, nunca un id enviado por el cliente.

/** Perfil guardado, o null. Las respuestas de una versión vieja del quiz se ignoran. */
export async function getUserProfile(
  userId: string,
): Promise<{ answers: QuizAnswers | null; preferences: Preferences; nickname: string | null; nicknameIsTemporary: boolean } | null> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } })
  if (!profile) return null

  const validated = profile.quizVersion !== null && profile.quizVersion >= QUIZ_COMPATIBLE_FROM && profile.quizVersion <= QUIZ_VERSION ? validateAnswers(profile.quizAnswers) : null
  return {
    answers: validated?.ok ? validated.answers : null,
    preferences: { locale: profile.locale, country: profile.country, currency: profile.currency },
    nickname: profile.nickname,
    nicknameIsTemporary: profile.nicknameIsTemporary,
  }
}

export async function saveQuizAnswers(userId: string, answers: QuizAnswers) {
  const data = { quizAnswers: answers as unknown as Prisma.InputJsonValue, quizVersion: QUIZ_VERSION }
  return prisma.userProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } })
}

export async function savePreferences(userId: string, preferences: Preferences) {
  return prisma.userProfile.upsert({ where: { userId }, update: preferences, create: { userId, ...preferences } })
}

/** Todo lo que la aplicación conserva de la persona (RF-05). */
export async function exportUserData(userId: string) {
  const [user, profile, collection, wearLogs, ownPerfumes, shares] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, createdAt: true } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userCollection.findMany({
      where: { userId },
      select: {
        status: true,
        rating: true,
        personalNotes: true,
        perfume: { select: { id: true, brand: true, name: true } },
      },
      orderBy: { perfume: { brand: 'asc' } },
    }),
    prisma.wearLog.findMany({
      where: { userId },
      select: { day: true, perfume: { select: { id: true, brand: true, name: true } } },
      orderBy: { day: 'asc' },
    }),
    // Perfumes que la persona cargó ella misma: son suyos, así que van completos (sin la ruta interna de la foto).
    prisma.perfume.findMany({
      where: { ownerId: userId, status: 'PRIVATE' },
      select: {
        id: true, brand: true, name: true, perfumer: true, gender: true, description: true,
        topNotes: true, heartNotes: true, baseNotes: true, longevity: true, sillage: true, createdAt: true,
        accords: { select: { accord: { select: { name: true } } }, orderBy: { accord: { name: 'asc' } } },
      },
      orderBy: [{ brand: 'asc' }, { name: 'asc' }],
    }),
    // Links para compartir la colección: solo lista, puntuaciones visibles y fecha; nunca el hash del token.
    prisma.collectionShare.findMany({
      where: { userId },
      select: { scope: true, showRatings: true, createdAt: true },
      orderBy: { scope: 'asc' },
    }),
  ])
  if (!user) return null

  return {
    exportedAt: new Date().toISOString(),
    user,
    profile: profile
      ? {
          quizAnswers: profile.quizAnswers,
          quizVersion: profile.quizVersion,
          locale: profile.locale,
          country: profile.country,
          currency: profile.currency,
          nickname: profile.nickname,
          nicknameIsTemporary: profile.nicknameIsTemporary,
          updatedAt: profile.updatedAt,
        }
      : null,
    collection,
    wearLogs,
    ownPerfumes: ownPerfumes.map(({ accords, ...perfume }) => ({ ...perfume, accords: accords.map((a) => a.accord.name) })),
    shares,
  }
}

/**
 * Elimina la fila User (la colección, el perfil y la racha se borran en cascada) y, en la misma transacción, guarda un resumen
 * anónimo para estadística (RF-05, docs/retencion-eliminacion-cuenta.md): sin correo, notas ni nada que identifique a la persona.
 * Si algo falla no se borra nada. `afterArchive` es solo un punto de inserción para probar esa atomicidad.
 * Devuelve cuántas filas de colección y perfil se llevó.
 */
export async function deleteUserData(userId: string, options: { afterArchive?: () => Promise<void> } = {}) {
  return prisma.$transaction(async (tx) => {
    // En secuencia: una transacción usa una sola conexión.
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } })
    const collection = await tx.userCollection.findMany({ where: { userId }, select: { perfumeId: true, status: true, rating: true } })
    const wearLogs = await tx.wearLog.findMany({ where: { userId }, select: { day: true } })
    const profile = await tx.userProfile.findUnique({ where: { userId }, select: { quizAnswers: true } })

    const summary = buildDeletionSummary({
      createdAt: user.createdAt,
      deletedAt: new Date(),
      hasQuizProfile: profile?.quizAnswers != null,
      collection,
      wearDays: wearLogs.map((w) => w.day),
    })
    const { collection: archivedCollection, ...audit } = summary
    const archived = await tx.deletedAccountAudit.create({ data: audit, select: { id: true } })
    // Un solo INSERT para toda la colección (el `create` anidado haría uno por fila y agotaría el tiempo con colecciones grandes).
    await tx.deletedAccountCollection.createMany({ data: archivedCollection.map((c) => ({ ...c, auditId: archived.id })) })
    await options.afterArchive?.()

    await tx.user.delete({ where: { id: userId } })
    return { collection: collection.length, profile: profile ? 1 : 0 }
  }, { timeout: 20_000 })
}
