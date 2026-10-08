'use server'

import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user || !data.user.email) {
    throw new Error('No autenticado')
  }

  return await getOrCreateUser({
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  })
}

export async function getUserCollection() {
  const user = await getAuthenticatedUser()

  return await prisma.userCollection.findMany({
    where: { userId: user.id },
    include: { perfume: true },
  })
}

export async function upsertCollectionEntry(data: {
  perfumeId: string
  status: 'OWNED' | 'SAMPLED' | 'WISHLIST' | 'DISLIKED'
  rating?: number
  personalNotes?: string
}) {
  // Validación mínima de rating
  if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
    throw new Error('Rating debe estar entre 1 y 5')
  }

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
