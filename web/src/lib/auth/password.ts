// Validación pura de contraseñas (sin red ni base). Mínimo 6; máximo 72 por el límite de bcrypt de Supabase.
// No se recortan los espacios: forman parte de la contraseña.

export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 72
export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres.`

export type PasswordError = 'empty' | 'short' | 'long' | 'mismatch' | 'same' | 'current-empty'

type LengthError = 'empty' | 'short' | 'long'

export function validatePassword(raw: unknown): { ok: true; password: string } | { ok: false; error: LengthError } {
  if (typeof raw !== 'string' || raw === '') return { ok: false, error: 'empty' }
  if (raw.length < PASSWORD_MIN) return { ok: false, error: 'short' }
  if (raw.length > PASSWORD_MAX) return { ok: false, error: 'long' }
  return { ok: true, password: raw }
}

export function validatePasswordPair(
  password: unknown,
  repeat: unknown,
): { ok: true; password: string } | { ok: false; error: LengthError | 'mismatch' } {
  const checked = validatePassword(password)
  if (!checked.ok) return checked
  if (password !== repeat) return { ok: false, error: 'mismatch' }
  return checked
}

export function validatePasswordChange(
  current: unknown,
  next: unknown,
  repeat: unknown,
): { ok: true; current: string; password: string } | { ok: false; error: PasswordError } {
  if (typeof current !== 'string' || current === '') return { ok: false, error: 'current-empty' }
  const pair = validatePasswordPair(next, repeat)
  if (!pair.ok) return pair
  if (pair.password === current) return { ok: false, error: 'same' }
  return { ok: true, current, password: pair.password }
}

/** Mensajes de la interfaz; las claves son las del parámetro `error` de las páginas. */
export const PASSWORD_ERRORS: Record<string, string> = {
  'password-empty': 'Escribí una contraseña.',
  'password-short': `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  'password-long': `La contraseña no puede superar los ${PASSWORD_MAX} caracteres.`,
  'password-mismatch': 'Las contraseñas no coinciden.',
  'password-same': 'La contraseña nueva tiene que ser distinta de la actual.',
  'password-current': 'Escribí tu contraseña actual.',
  'password-wrong': 'La contraseña actual no es correcta.',
}
