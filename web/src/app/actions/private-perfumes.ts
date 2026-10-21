'use server'

import { randomUUID } from 'node:crypto'
import { refresh, revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getAuthenticatedUserOrNull } from '@/lib/auth/require-user'
import { collectionInputFromFormData, type CollectionFormState } from '@/lib/collection/form'
import { isValidPerfumeId, validateCollectionEntry } from '@/lib/collection/validation'
import { logServerError } from '@/lib/log'
import { isDuplicatePerfumeError, createPrivatePerfume, deletePrivatePerfume, getOwnPrivatePerfume, updatePrivatePerfume } from '@/lib/private-perfumes/data'
import { checkUploadedPhoto, isPhotoExtension, type PhotoExtension } from '@/lib/private-perfumes/photo'
import { createUploadTarget, isPhotoStorageAvailable, photoExists, removePhotos } from '@/lib/private-perfumes/storage'
import { privatePerfumeInputFromFormData, validatePrivatePerfume } from '@/lib/private-perfumes/validation'
import { RATE_LIMIT_MESSAGE, limitAction } from '@/lib/rate-limit'

// Las Server Actions son endpoints públicos: se valida todo en el servidor y la persona sale siempre de la sesión.
// Escrituras: el mismo contador de 30 por minuto que usa la colección.
const writeAllowed = (userId: string) => limitAction('collection', userId, { limit: 30, windowMs: 60_000 }).ok

const SESSION_EXPIRED = 'Tu sesión venció. Volvé a ingresar para guardarlo.'
const GENERIC_ERROR = 'No pudimos guardarlo. Probá de nuevo en un momento.'
const PHOTO_UNAVAILABLE = 'Subir fotos no está disponible por ahora. Probá más tarde.'

const fail = (message: string): CollectionFormState => ({ status: 'error', message })

function revalidateCollection() {
  revalidatePath('/mi-coleccion')
  revalidatePath('/')
}

/** Datos del perfume y de la entrada de colección a partir del formulario, ya validados. */
function parseForm(formData: FormData) {
  const perfume = validatePrivatePerfume(privatePerfumeInputFromFormData(formData))
  if (!perfume.ok) return perfume
  // El id del perfume lo pone el servidor: la validación de la entrada solo necesita uno con forma válida.
  const entry = validateCollectionEntry({ ...collectionInputFromFormData(formData), perfumeId: 'pending' })
  if (!entry.ok) {
    return { ok: false as const, error: entry.error.startsWith('status') ? 'Elegí un estado para guardarlo (por ejemplo, "Lo tengo").' : entry.error }
  }
  const { status, rating, personalNotes } = entry.value
  return { ok: true as const, perfume: perfume.value, entry: { status, rating, personalNotes } }
}

type PhotoUploadResponse = { ok: true; path: string; token: string } | { ok: false; message: string }

/** Pide una ruta nueva y un token de un solo uso para subir la foto directo a Storage. */
export async function requestPhotoUploadAction(extension: PhotoExtension = 'webp'): Promise<PhotoUploadResponse> {
  try {
    if (!isPhotoExtension(extension)) return { ok: false, message: GENERIC_ERROR }
    if (!isPhotoStorageAvailable()) return { ok: false, message: PHOTO_UNAVAILABLE }
    const user = await getAuthenticatedUserOrNull()
    if (!user?.supabaseId) return { ok: false, message: SESSION_EXPIRED }
    if (!writeAllowed(user.id)) return { ok: false, message: RATE_LIMIT_MESSAGE }
    const target = await createUploadTarget(user.supabaseId, randomUUID(), extension)
    return target ? { ok: true, ...target } : { ok: false, message: PHOTO_UNAVAILABLE }
  } catch (error) {
    logServerError('private-perfumes/request-upload', error)
    return { ok: false, message: GENERIC_ERROR }
  }
}

export async function createPrivatePerfumeAction(_previous: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  const parsed = parseForm(formData)
  if (!parsed.ok) return fail(parsed.error)

  let createdId: string
  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user?.supabaseId) return fail(SESSION_EXPIRED)
    if (!writeAllowed(user.id)) return fail(RATE_LIMIT_MESSAGE)

    const path = formData.get('photoPath')
    const photo = checkUploadedPhoto(user.supabaseId, path, typeof path === 'string' ? await photoExists(path) : { exists: false, bytes: 0 })
    if (!photo.ok) return fail(photo.message)

    createdId = (await createPrivatePerfume(user.id, randomUUID(), path as string, parsed.perfume, parsed.entry)).id
  } catch (error) {
    if (isDuplicatePerfumeError(error)) return fail('Ya tenés un perfume propio con esa marca y ese nombre.')
    logServerError('private-perfumes/create', error)
    return fail(GENERIC_ERROR)
  }

  revalidateCollection()
  redirect(`/mi-coleccion/${createdId}`)
}

export async function updatePrivatePerfumeAction(_previous: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  const perfumeId = formData.get('perfumeId')
  if (typeof perfumeId !== 'string' || !isValidPerfumeId(perfumeId)) return fail('No encontramos ese perfume.')
  const parsed = parseForm(formData)
  if (!parsed.ok) return fail(parsed.error)

  let oldPhoto: string | null = null
  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user?.supabaseId) return fail(SESSION_EXPIRED)
    if (!writeAllowed(user.id)) return fail(RATE_LIMIT_MESSAGE)

    const current = await getOwnPrivatePerfume(user.id, perfumeId)
    if (!current) return fail('No encontramos ese perfume.')

    // Sin foto nueva (campo vacío o igual a la actual) se conserva la que ya tiene.
    const submitted = formData.get('photoPath')
    let newPath: string | undefined
    if (typeof submitted === 'string' && submitted && submitted !== current.imagePath) {
      const photo = checkUploadedPhoto(user.supabaseId, submitted, await photoExists(submitted))
      if (!photo.ok) return fail(photo.message)
      newPath = submitted
    }

    if (!(await updatePrivatePerfume(user.id, perfumeId, newPath, parsed.perfume, parsed.entry))) return fail('No encontramos ese perfume.')
    if (newPath) oldPhoto = current.imagePath
  } catch (error) {
    if (isDuplicatePerfumeError(error)) return fail('Ya tenés un perfume propio con esa marca y ese nombre.')
    logServerError('private-perfumes/update', error)
    return fail(GENERIC_ERROR)
  }

  if (oldPhoto) await removePhotos([oldPhoto])
  revalidateCollection()
  redirect(`/mi-coleccion/${perfumeId}`)
}

export async function deletePrivatePerfumeAction(_previous: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  const perfumeId = formData.get('perfumeId')
  if (typeof perfumeId !== 'string' || !isValidPerfumeId(perfumeId)) return fail('No pudimos eliminarlo. Probá de nuevo en un momento.')

  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user) return fail('Tu sesión venció. Volvé a ingresar para eliminarlo.')
    if (!writeAllowed(user.id)) return fail(RATE_LIMIT_MESSAGE)

    const photo = await deletePrivatePerfume(user.id, perfumeId)
    if (photo !== null) await removePhotos([photo])
  } catch (error) {
    logServerError('private-perfumes/delete', error)
    return fail('No pudimos eliminarlo. Probá de nuevo en un momento.')
  }

  revalidateCollection()
  refresh()
  redirect('/mi-coleccion')
}
