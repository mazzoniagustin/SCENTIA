'use server'

import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isValidPerfumeId, validateCollectionEntry, type CollectionEntryInput } from '@/lib/collection/validation'

const getAuthenticatedUser = requireUser

export async function getUserCollection() {
  const user = await getAuthenticatedUser()

  return await prisma.userCollection.findMany({
    where: { userId: user.id },
    include: { perfume: true },
  })
}

export async function upsertCollectionEntry(input: CollectionEntryInput) {
  // Las Server Actions son endpoints públicos: los tipos no se validan en ejecución.
  const validated = validateCollectionEntry(input)
  if (!validated.ok) throw new Error(validated.error)
  const data = validated.value

  const user = await getAuthenticatedUser()

  return await prisma.userCollection.upsert({
    where: {
      userId_perfumeId: {
        userId: user.id,
        perfumeId: data.perfumeId,
      },
    },
    update: {
      status: data.status,
      rating: data.rating,
      personalNotes: data.personalNotes,
    },
    create: {
      userId: user.id,
      perfumeId: data.perfumeId,
      status: data.status,
      rating: data.rating,
      personalNotes: data.personalNotes,
    },
  })
}

export async function deleteCollectionEntry(perfumeId: string) {
  if (!isValidPerfumeId(perfumeId)) throw new Error('perfumeId inválido')
  const user = await getAuthenticatedUser()

  return await prisma.userCollection.delete({
    where: {
      userId_perfumeId: {
        userId: user.id,
        perfumeId,
      },
    },
  })
}
