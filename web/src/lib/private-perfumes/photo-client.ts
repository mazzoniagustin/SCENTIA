// Reglas de la foto del lado del navegador (antes de subirla). Lógica pura: sin DOM ni red; el procesamiento con canvas y la
// subida viven en photo-upload.ts.

/** Lado mayor de la foto ya achicada (spec: 800 px). */
export const MAX_SIDE = 800
/** Tope de la foto original que se acepta procesar. */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024
/** Calidad WebP de la foto achicada (deja unos 50-120 KB). */
export const WEBP_QUALITY = 0.8

/**
 * Para el atributo `accept` del selector de archivos. A propósito NO incluye HEIC/HEIF: si el selector no lo pide, iOS (Safari y
 * Chrome) y Android convierten la foto a JPEG al elegirla o sacarla, y así no depende de que el navegador sepa leer HEIC.
 */
export const ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/webp'

/** Achica `width` × `height` para que el lado mayor no pase de `maxSide`, conservando la proporción. Nunca agranda. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Dimensiones inválidas')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export type FileCheck = { ok: true } | { ok: false; message: string }

/**
 * Chequeo previo y permisivo: el tipo que informa el navegador no es confiable (algunos teléfonos lo dejan vacío o ponen HEIC), así
 * que solo se descarta lo que claramente no es una foto. Si el archivo no se puede leer, lo decide el decodificador al procesarla.
 */
export function acceptPhotoFile(file: { type: string; size: number }): FileCheck {
  const type = file.type.toLowerCase()
  const looksLikePhoto = type === '' || (type.startsWith('image/') && type !== 'image/svg+xml')
  if (!looksLikePhoto) return { ok: false, message: 'Elegí una foto JPG, PNG o WebP.' }
  if (file.size <= 0) return { ok: false, message: 'Ese archivo está vacío.' }
  if (file.size > MAX_INPUT_BYTES) return { ok: false, message: 'La foto pesa más de 10 MB. Elegí una más liviana.' }
  return { ok: true }
}
