// Reglas de la foto del lado del navegador (antes de subirla). Lógica pura: sin DOM ni red; el procesamiento con canvas y la
// subida viven en photo-upload.ts.

/** Lado mayor de la foto ya achicada (spec: 800 px). */
export const MAX_SIDE = 800
/** Tope de la foto original que se acepta procesar. */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024
/** Calidad WebP de la foto achicada (deja unos 50-120 KB). */
export const WEBP_QUALITY = 0.8

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
/** Para el atributo `accept` del selector de archivos. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',')

/** Achica `width` × `height` para que el lado mayor no pase de `maxSide`, conservando la proporción. Nunca agranda. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Dimensiones inválidas')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export type FileCheck = { ok: true } | { ok: false; message: string }

export function acceptPhotoFile(file: { type: string; size: number }): FileCheck {
  if (!ACCEPTED_TYPES.includes(file.type)) return { ok: false, message: 'Elegí una foto JPG, PNG o WebP.' }
  if (file.size <= 0) return { ok: false, message: 'Ese archivo está vacío.' }
  if (file.size > MAX_INPUT_BYTES) return { ok: false, message: 'La foto pesa más de 10 MB. Elegí una más liviana.' }
  return { ok: true }
}
