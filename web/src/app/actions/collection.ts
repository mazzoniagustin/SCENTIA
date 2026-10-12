'use server'

import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { refresh, revalidatePath } from 'next/cache'
import { collectionInputFromFormData, type CollectionFormState } from '@/lib/collection/form'
import { RATE_LIMIT_MESSAGE, limitAction } from '@/lib/rate-limit'
import { logServerError } from '@/lib/log'
import { getAuthenticatedUserOrNull } from '@/lib/auth/require-user'
import { upsertCollectionForUser } from '@/lib/collection/data'
import { isValidPerfumeId, validateCollectionEntry, type CollectionEntryInput } from '@/lib/collection/validation'

const getAuthenticatedUser = requireUser

// Escrituras de colección: 30 por minuto por persona (contador compartido entre las acciones).
const collectionWriteAllowed = (userId: string) => limitAction('collection', userId, { limit: 30, windowMs: 60_000 }).ok

export async function getUserCollection() {
  const user = await getAuthenticatedUser()

  return await prisma.userCollection.findMany({
    where: { userId: user.id },
    include: { perfume: { include: { accords: { include: { accord: true } } } } },
  })
}

export async function upsertCollectionEntry(input: CollectionEntryInput) {
  // Las Server Actions son endpoints públicos: los tipos no se validan en ejecución.
  const validated = validateCollectionEntry(input)
  if (!validated.ok) throw new Error(validated.error)
  const data = validated.value

  const user = await getAuthenticatedUser()
  if (!collectionWriteAllowed(user.id)) throw new Error('rate')

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
  // Es un form action sin estado donde mostrar un mensaje: al exceder el límite no borra y deja la pantalla como está.
  if (!collectionWriteAllowed(user.id)) return null

  return await prisma.userCollection.delete({
    where: {
      userId_perfumeId: {
        userId: user.id,
        perfumeId,
      },
    },
  })
}

// Acción del formulario de la colección: nunca lanza; devuelve un estado para mostrar el resultado (guardado o error) en pantalla.
// Es un endpoint público: se valida todo en el servidor y el usuario sale siempre de la sesión.
export async function saveCollectionEntryAction(_previous: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  const validated = validateCollectionEntry(collectionInputFromFormData(formData))
  if (!validated.ok) {
    const message = validated.error.startsWith('status') ? 'Elegí un estado para guardarlo (por ejemplo, "Lo tengo").' : validated.error
    return { status: 'error', message }
  }

  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user) return { status: 'error', message: 'Tu sesión venció. Volvé a ingresar para guardarlo.' }

    if (!collectionWriteAllowed(user.id)) return { status: 'error', message: RATE_LIMIT_MESSAGE }

    await upsertCollectionForUser(user.id, validated.value)
  } catch (error) {
    logServerError('collection/save', error)
    return { status: 'error', message: 'No pudimos guardarlo. Probá de nuevo en un momento.' }
  }

  // Catálogo, fichas, marcas, Mi colección y la portada (racha) muestran el estado de la colección.
  revalidatePath('/perfumes', 'layout')
  revalidatePath('/marcas', 'layout')
  revalidatePath('/mi-coleccion')
  revalidatePath('/')
  // Además de invalidar el caché, refresca la pantalla actual para que el cambio se vea sin recargar.
  refresh()
  return { status: 'success', message: 'Guardado en tu colección.' }
}
