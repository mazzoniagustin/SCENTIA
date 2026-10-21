// Reglas de la foto de un perfume propio. La foto vive en un bucket privado de Supabase Storage; en la base solo se guarda su ruta.
// La carpeta es el id de Supabase de la persona (no el cuid de `User`): las políticas de Storage lo comparan con `auth.uid()`.
// Lógica pura: sin red ni base de datos.

export const PHOTO_BUCKET = 'private-perfumes'
/** Tope de la foto ya achicada (el navegador la deja en ~50-120 KB); el servidor lo verifica antes de guardar el perfume. */
export const MAX_PHOTO_BYTES = 307200

const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Formatos de la foto ya achicada: WebP, o JPEG en los navegadores que no pueden codificar WebP (Safari en iOS). */
export const PHOTO_EXTENSIONS = ['webp', 'jpg'] as const
export type PhotoExtension = (typeof PHOTO_EXTENSIONS)[number]

export function isPhotoExtension(value: unknown): value is PhotoExtension {
  return PHOTO_EXTENSIONS.includes(value as PhotoExtension)
}

export function photoPath(supabaseId: string, perfumeId: string, extension: PhotoExtension = 'webp'): string {
  return `${supabaseId}/${perfumeId}.${extension}`
}

/** La ruta es `{supabaseId}/{id}.webp` (o `.jpg`), de la carpeta de esa persona y sin saltos de directorio. */
export function isOwnPhotoPath(supabaseId: string, path: unknown): path is string {
  if (typeof path !== 'string' || !PHOTO_ID.test(supabaseId)) return false
  const prefix = `${supabaseId}/`
  if (!path.startsWith(prefix)) return false
  const extension = PHOTO_EXTENSIONS.find((e) => path.endsWith(`.${e}`))
  if (!extension) return false
  return PHOTO_ID.test(path.slice(prefix.length, -(extension.length + 1)))
}

export type PhotoCheck = { ok: true } | { ok: false; message: string }

/** Decide si la foto que dice haber subido la persona se puede guardar: es suya, existe y entra en el tope. */
export function checkUploadedPhoto(supabaseId: string, path: unknown, stat: { exists: boolean; bytes: number }): PhotoCheck {
  if (!isOwnPhotoPath(supabaseId, path)) return { ok: false, message: 'La foto no es válida. Subila de nuevo.' }
  if (!stat.exists || stat.bytes <= 0) return { ok: false, message: 'No encontramos la foto subida. Probá de nuevo.' }
  if (stat.bytes > MAX_PHOTO_BYTES) return { ok: false, message: 'La foto pesa demasiado. Probá con otra más liviana.' }
  return { ok: true }
}

const SIGNED_PREFIX = `/storage/v1/object/sign/${PHOTO_BUCKET}/`

/**
 * ¿Es la URL firmada de una foto propia en nuestro Supabase? Es lo único de Storage que se muestra como imagen: mismo host que
 * NEXT_PUBLIC_SUPABASE_URL, https, sin credenciales y de la ruta de firma del bucket de fotos propias.
 */
export function isOwnPhotoUrl(value: unknown, supabaseUrl: string | undefined): value is string {
  if (typeof value !== 'string' || !supabaseUrl) return false
  let url: URL
  let base: URL
  try {
    url = new URL(value)
    base = new URL(supabaseUrl)
  } catch {
    return false
  }
  return url.protocol === 'https:' && !url.username && !url.password && url.host === base.host && url.pathname.startsWith(SIGNED_PREFIX)
}
