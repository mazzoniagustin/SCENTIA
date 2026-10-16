// Apodo público de la persona. Validación pura (sin base ni `server-only`) para poder probarla con node:test.
// El apodo que llega en `user_metadata` o en un formulario lo controla el cliente: se vuelve a validar acá
// en el servidor antes de guardarlo. Solo ASCII, para evitar homógrafos (a latina / a cirílica).

export const NICKNAME_MIN = 3
export const NICKNAME_MAX = 20
export const NICKNAME_HINT = `${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres: letras sin acentos, números, guion y guion bajo.`

const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/

// Comparados contra la clave (minúsculas).
const RESERVED = new Set([
  'admin',
  'administrador',
  'administrator',
  'root',
  'soporte',
  'support',
  'staff',
  'moderador',
  'moderator',
  'mod',
  'scentia',
  'sistema',
  'system',
  'null',
  'undefined',
  'anonimo',
  'anonymous',
  'eliminado',
  'deleted',
  'api',
])

export type NicknameError = 'invalid' | 'reserved'

export type NicknameResult =
  | { ok: true; nickname: string; key: string }
  | { ok: false; error: NicknameError }

/** Clave de unicidad: el apodo en minúsculas. Equivale a lower("nickname") del índice único de la base. */
export function nicknameKey(nickname: string): string {
  return nickname.toLowerCase()
}

/** El apodo es opcional al registrarse: ausente, `null` o texto vacío / solo espacios cuentan como "no escribió ninguno". */
export function isNicknameOmitted(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
}

/** `raw` puede ser cualquier valor (los metadatos del usuario son JSON arbitrario). */
export function validateNickname(raw: unknown): NicknameResult {
  if (typeof raw !== 'string') return { ok: false, error: 'invalid' }
  const nickname = raw.trim()
  if (!NICKNAME_PATTERN.test(nickname)) return { ok: false, error: 'invalid' }
  const key = nicknameKey(nickname)
  if (RESERVED.has(key)) return { ok: false, error: 'reserved' }
  return { ok: true, nickname, key }
}

export const TEMPORARY_NICKNAME_PREFIX = 'perfumista-'

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Apodo temporal con 6 caracteres aleatorios; `randomByte` se inyecta para poder probarlo. */
export function generateTemporaryNickname(randomByte: () => number = () => Math.floor(Math.random() * 256)): string {
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += BASE36[randomByte() % BASE36.length]
  return `${TEMPORARY_NICKNAME_PREFIX}${suffix}`
}

export const NICKNAME_ERRORS: Record<string, string> = {
  nickname: `El apodo no es válido. ${NICKNAME_HINT}`,
  'nickname-reserved': 'Ese apodo está reservado. Elegí otro.',
  'nickname-taken': 'Ese apodo ya está en uso. Elegí otro.',
}

export const NICKNAME_INDEX = 'UserProfile_nickname_lower_key'

/**
 * ¿El error de Prisma es la violación del índice único del apodo? El índice es sobre lower("nickname")
 * y Prisma no lo conoce, así que `meta.target` puede venir vacío: se mira también el nombre de la
 * restricción que informa el adaptador de pg y, como último recurso, el mensaje.
 */
export function isNicknameConflict(caught: unknown): boolean {
  const error = caught as {
    code?: string
    message?: string
    meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: string } } } }
  } | null
  if (!error || error.code !== 'P2002') return false
  const target = error.meta?.target
  const index = error.meta?.driverAdapterError?.cause?.constraint?.index
  if (index === NICKNAME_INDEX) return true
  if (typeof target === 'string' && target.includes('nickname')) return true
  if (Array.isArray(target) && target.some((t) => String(t).includes('nickname'))) return true
  return typeof error.message === 'string' && error.message.includes(NICKNAME_INDEX)
}
