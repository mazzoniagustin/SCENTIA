import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateAnswers } from '@/lib/quiz/profile'
import { QUIZ_VERSION, type QuizAnswers } from '@/lib/quiz/questions'
import type { Preferences } from './preferences'

// Datos personales por usuario (cuid de la tabla User): perfil del quiz, preferencias,
// exportación y eliminación (RF-05). Cada función recibe el `userId` de la sesión del
// servidor, nunca un id enviado por el cliente.

/** Perfil guardado, o null. Las respuestas de una versión vieja del quiz se ignoran. */
export async function getUserProfile(userId: string): Promise<{ answers: QuizAnswers | null; preferences: Preferences } | null> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } })
  if (!profile) return null

  const validated = profile.quizVersion === QUIZ_VERSION ? validateAnswers(profile.quizAnswers) : null
  return {
    answers: validated?.ok ? validated.answers : null,
    preferences: { locale: profile.locale, country: profile.country, currency: profile.currency },
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
  const [user, profile, collection, wearLogs] = await Promise.all([
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
          updatedAt: profile.updatedAt,
        }
      : null,
    collection,
    wearLogs,
  }
}

/** Elimina la fila User; la colección y el perfil se borran en cascada. Devuelve cuántas filas se llevó. */
export async function deleteUserData(userId: string) {
  const [collection, profile] = await Promise.all([
    prisma.userCollection.count({ where: { userId } }),
    prisma.userProfile.count({ where: { userId } }),
  ])
  await prisma.user.delete({ where: { id: userId } })
  return { collection, profile }
}
