// Imágenes de perfumes enlazadas (hotlink) desde su origen: no se descargan ni se re-hospedan.
// Solo se aceptan URLs https de una lista corta de hosts. Lógica pura (sin base de datos ni red).

/** Hosts desde los que se permite mostrar imágenes. */
export const ALLOWED_IMAGE_HOSTS: readonly string[] = ['fimgs.net']
/** Hosts de las páginas de origen que se enlazan en el crédito. */
export const ALLOWED_SOURCE_PAGE_HOSTS: readonly string[] = ['www.fragrantica.com']
/** Nombre de la fuente que se muestra en el crédito. */
export const IMAGE_SOURCE_LABEL = 'Fragrantica'

const MAX_URL_LENGTH = 500

/** https, host exacto de la lista, sin usuario/clave ni puerto, y de largo razonable. */
export function isAllowedUrl(value: unknown, hosts: readonly string[]): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname)
}

export const isAllowedImageUrl = (value: unknown): value is string => isAllowedUrl(value, ALLOWED_IMAGE_HOSTS)
export const isAllowedSourcePageUrl = (value: unknown): value is string => isAllowedUrl(value, ALLOWED_SOURCE_PAGE_HOSTS)

export type ImageFields = { imageUrl: string; imageSource: string; imageSourceUrl: string | null }

/** Campos de imagen a partir de un registro del dataset (`picture` y `url`); null si la imagen no es válida. */
export function imageFieldsFromRecord(record: { picture?: unknown; url?: unknown }): ImageFields | null {
  if (!isAllowedImageUrl(record.picture)) return null
  return {
    imageUrl: record.picture,
    imageSource: IMAGE_SOURCE_LABEL,
    imageSourceUrl: isAllowedSourcePageUrl(record.url) ? record.url : null,
  }
}
