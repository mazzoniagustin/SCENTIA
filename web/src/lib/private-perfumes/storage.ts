import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { logServerError } from '@/lib/log'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { PHOTO_BUCKET, photoPath } from './photo'
import { listFolderPaths, photoExistsIn, removePhotosFrom, signPhotoUrlsWith, type PhotoBucket } from './storage-core'

// Fotos de perfumes propios en un bucket privado de Supabase Storage. Se usa la clave de servicio
// (SUPABASE_SERVICE_ROLE_KEY, solo en el servidor y fuera del repositorio): las rutas siempre las arma o las verifica el
// servidor contra el id de la persona con sesión. Sin la clave, la función de fotos no está disponible (`null`).

function photoBucket(): PhotoBucket | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  const { url } = getSupabaseConfig()
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  // La interfaz `PhotoBucket` es el subconjunto que usa la aplicación; el tipo del SDK es más amplio.
  return client.storage.from(PHOTO_BUCKET) as unknown as PhotoBucket
}

export const isPhotoStorageAvailable = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

/** Ruta nueva y token para que el navegador suba la foto directo a Storage (no pasa por las funciones de Vercel). */
export async function createUploadTarget(supabaseId: string, fileId: string): Promise<{ path: string; token: string } | null> {
  const bucket = photoBucket()
  if (!bucket) return null
  const path = photoPath(supabaseId, fileId)
  try {
    const { data, error } = await bucket.createSignedUploadUrl(path)
    if (error || !data) {
      logServerError('private-perfumes/upload-target', error ?? new Error('sin datos'))
      return null
    }
    return { path, token: data.token }
  } catch (error) {
    logServerError('private-perfumes/upload-target', error)
    return null
  }
}

/** ruta → URL firmada (1 hora). Las rutas que no se pueden firmar no aparecen en el mapa. */
export async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const bucket = photoBucket()
  if (!bucket) return new Map()
  return signPhotoUrlsWith(bucket, paths)
}

/**
 * `imageUrl` listo para mostrar: en un perfume propio la columna guarda una ruta de Storage y se reemplaza por su URL firmada
 * (null si no se pudo firmar: se muestra la portada generada); en uno del catálogo es la URL de siempre.
 */
export async function displayImageUrls<T extends { status: string; imageUrl: string | null }>(rows: readonly T[]): Promise<Array<string | null>> {
  const own = rows.filter((r) => r.status === 'PRIVATE' && r.imageUrl).map((r) => r.imageUrl as string)
  const signed = own.length ? await signPhotoUrls(own) : new Map<string, string>()
  return rows.map((r) => (r.status === 'PRIVATE' ? (r.imageUrl ? (signed.get(r.imageUrl) ?? null) : null) : r.imageUrl))
}

export async function photoExists(path: string): Promise<{ exists: boolean; bytes: number }> {
  const bucket = photoBucket()
  return bucket ? photoExistsIn(bucket, path) : { exists: false, bytes: 0 }
}

/**
 * Borra TODAS las fotos de una persona: las que figuran en la base (`knownPaths`) y las que subió y nunca guardó (cambió la foto
 * antes de guardar, abandonó el formulario). Se usa al eliminar la cuenta. No lanza.
 */
export async function removeAllPhotosOf(supabaseId: string | null, knownPaths: string[]): Promise<void> {
  const bucket = photoBucket()
  if (!bucket) {
    if (knownPaths.length || supabaseId) console.warn('[private-perfumes/storage] SUPABASE_SERVICE_ROLE_KEY no está configurada: las fotos no se borraron de Storage')
    return
  }
  const listed = supabaseId ? await listFolderPaths(bucket, supabaseId) : []
  await removePhotos([...new Set([...knownPaths, ...listed])])
}

/** Borra fotos; si falla queda un archivo huérfano (ocupa cuota, no expone nada) y se registra. */
export async function removePhotos(paths: string[]): Promise<void> {
  const real = paths.filter(Boolean)
  if (real.length === 0) return
  const bucket = photoBucket()
  if (!bucket) {
    console.warn('[private-perfumes/storage] SUPABASE_SERVICE_ROLE_KEY no está configurada: las fotos no se borraron de Storage')
    return
  }
  if (!(await removePhotosFrom(bucket, real))) logServerError('private-perfumes/remove-photos', new Error(`no se pudieron borrar ${real.length} foto(s)`))
}
