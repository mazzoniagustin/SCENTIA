// Núcleo de las acciones con contraseña (registro, ingreso, elegir y cambiar). Sin `server-only` ni `@/` y con las dependencias
// inyectadas, para probarlo con node:test sin red ni base. Cada función devuelve la ruta a la que redirigir; la Server Action
// la usa con `redirect()`. Nunca devuelve la contraseña ni el correo en la ruta.

import { isNicknameOmitted, validateNickname } from '../account/nickname.ts'
import { EMAIL_PATTERN } from './magic-link.ts'
import { validatePassword, validatePasswordChange, validatePasswordPair } from './password.ts'

export type AuthApiError = { code?: string; status?: number; message?: string }
type AuthResult = { error: AuthApiError | null }

export type ChoosePasswordDeps = {
  /** false si se superó el límite de acciones de esta persona. */
  allowAction: () => boolean
  /** false si la sesión ya tiene contraseña y no viene de un enlace reciente: ahí hay que usar "Cambiar contraseña" (con la actual). */
  canChoose: () => boolean
  updateUser: (args: { password: string; data: { password_set: true } }) => Promise<AuthResult>
  /** Refresca la sesión para que el token traiga `password_set`; sin esto el control del proxy seguiría pidiendo la contraseña. */
  refreshSession: () => Promise<AuthResult>
}

const CHOOSE_PAGE = '/elegir-contrasena'

/** Guarda la contraseña elegida y marca la cuenta. Éxito solo si se guardó Y se refrescó la sesión. */
export async function choosePassword(input: { password: unknown; repeat: unknown }, deps: ChoosePasswordDeps): Promise<string> {
  if (!deps.canChoose()) return '/account'
  if (!deps.allowAction()) return `${CHOOSE_PAGE}?error=rate`

  const checked = validatePasswordPair(input.password, input.repeat)
  if (!checked.ok) return `${CHOOSE_PAGE}?error=password-${checked.error}`

  try {
    const updated = await deps.updateUser({ password: checked.password, data: { password_set: true } })
    // `same_password`: ya se guardó antes y falló el refresco; se refresca igual para que el token traiga la marca.
    if (updated.error && updated.error.code !== 'same_password') return `${CHOOSE_PAGE}?error=unavailable`
    const refreshed = await deps.refreshSession()
    if (refreshed.error) return `${CHOOSE_PAGE}?error=unavailable`
  } catch {
    return `${CHOOSE_PAGE}?error=unavailable`
  }
  return '/account'
}

export type PasswordAuthDeps = {
  /** URL base del sitio (SITE_URL en producción); null si no se puede determinar. */
  origin: string | null
  /** false si se superó el límite de intentos de esta IP. */
  allowRequest: () => boolean
  /** Solo UX: avisa antes de crear la cuenta. La garantía de unicidad es el índice de la base. */
  isNicknameTaken: (key: string) => Promise<boolean>
  signUp: (args: {
    email: string
    password: string
    options: { emailRedirectTo: string; data: { password_set: true; nickname?: string } }
  }) => Promise<AuthResult>
  signInWithPassword: (args: { email: string; password: string }) => Promise<AuthResult>
  /** Registro del servidor para fallos que no son del usuario (nunca recibe correo ni contraseña). */
  report?: (scope: string, detail: string) => void
}

/** Límite de Supabase (429) o caída del servicio: no es culpa de las credenciales y no hay que decir "incorrectas". */
function isServiceFailure(error: AuthApiError) {
  return error.status === 429 || (error.status ?? 0) >= 500 || error.code === 'over_request_rate_limit'
}

const describeError = (error: AuthApiError) => `status=${error.status ?? 'n/a'} code=${error.code ?? 'n/a'}`

function pageUrl(page: string, parameters: Record<string, string>) {
  return `${page}?${new URLSearchParams(parameters).toString()}`
}

const normalizeEmail = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '')

/**
 * Registro con correo y contraseña. Con "Confirm email" activo en Supabase la cuenta no tiene sesión hasta abrir el enlace del correo.
 * Un correo ya registrado responde igual que uno nuevo (Supabase no da error): no se revela qué correos existen.
 * Solo el apodo (público) vuelve en la URL, nunca el correo ni la contraseña.
 */
export async function signUpWithPassword(
  input: { email: unknown; password: unknown; nickname?: unknown },
  deps: PasswordAuthDeps,
): Promise<string> {
  const page = '/registro'
  const rawNickname = typeof input.nickname === 'string' ? input.nickname.trim() : ''
  const keepNickname: Record<string, string> = rawNickname ? { nickname: rawNickname.slice(0, 40) } : {}

  if (!deps.allowRequest()) return pageUrl(page, { error: 'rate', ...keepNickname })

  const email = normalizeEmail(input.email)
  if (!EMAIL_PATTERN.test(email)) return pageUrl(page, { error: 'email', ...keepNickname })

  const password = validatePassword(input.password)
  if (!password.ok) return pageUrl(page, { error: `password-${password.error}`, ...keepNickname })

  let nickname: string | undefined
  if (!isNicknameOmitted(input.nickname)) {
    const validated = validateNickname(input.nickname)
    if (!validated.ok) return pageUrl(page, { error: validated.error === 'reserved' ? 'nickname-reserved' : 'nickname', ...keepNickname })
    if (await deps.isNicknameTaken(validated.key)) return pageUrl(page, { error: 'nickname-taken', ...keepNickname })
    nickname = validated.nickname
  }

  if (!deps.origin) return pageUrl(page, { error: 'request', ...keepNickname })

  try {
    const { error } = await deps.signUp({
      email,
      password: password.password,
      options: {
        emailRedirectTo: new URL('/auth/confirm', deps.origin).toString(),
        data: { password_set: true, ...(nickname ? { nickname } : {}) },
      },
    })
    if (error) {
      if (error.code !== 'weak_password') deps.report?.('password-signup', describeError(error))
      return pageUrl(page, { error: error.code === 'weak_password' ? 'password-short' : 'unavailable', ...keepNickname })
    }
  } catch {
    deps.report?.('password-signup', 'la llamada lanzó una excepción')
    return pageUrl(page, { error: 'unavailable', ...keepNickname })
  }
  return pageUrl(page, { sent: '1' })
}

/** Ingreso con correo y contraseña. Todo fallo de credenciales (correo inexistente, contraseña errónea, sin confirmar) es el mismo error. */
export async function signInWithPasswordCore(
  input: { email: unknown; password: unknown },
  deps: Pick<PasswordAuthDeps, 'allowRequest' | 'signInWithPassword' | 'report'>,
): Promise<string> {
  if (!deps.allowRequest()) return '/login?error=rate'

  const email = normalizeEmail(input.email)
  if (!EMAIL_PATTERN.test(email)) return '/login?error=email'
  if (typeof input.password !== 'string' || input.password === '') return '/login?error=credentials'

  try {
    const { error } = await deps.signInWithPassword({ email, password: input.password })
    if (error && isServiceFailure(error)) {
      deps.report?.('password-signin', describeError(error))
      return '/login?error=unavailable'
    }
    if (error) return '/login?error=credentials'
  } catch {
    deps.report?.('password-signin', 'la llamada lanzó una excepción')
    return '/login?error=unavailable'
  }
  return '/account'
}

export type ChangePasswordDeps = {
  /** false si se superó el límite de acciones de esta persona. */
  allowAction: () => boolean
  /** Comprueba la contraseña actual (se prueba contra Supabase con el correo de la sesión). */
  verifyCurrent: (password: string) => Promise<boolean>
  updateUser: (args: { password: string; data: { password_set: true } }) => Promise<AuthResult>
  refreshSession: () => Promise<AuthResult>
}

/** Cambio de contraseña desde /account: exige la actual, y la nueva debe ser válida y distinta. Nada se modifica si algo falla. */
export async function changePassword(
  input: { current: unknown; password: unknown; repeat: unknown },
  deps: ChangePasswordDeps,
): Promise<string> {
  if (!deps.allowAction()) return '/account?error=rate'

  const checked = validatePasswordChange(input.current, input.password, input.repeat)
  if (!checked.ok) return `/account?error=password-${checked.error === 'current-empty' ? 'current' : checked.error}`

  try {
    if (!(await deps.verifyCurrent(checked.current))) return '/account?error=password-wrong'
    const updated = await deps.updateUser({ password: checked.password, data: { password_set: true } })
    if (updated.error && updated.error.code !== 'same_password') return '/account?error=password-unavailable'
    const refreshed = await deps.refreshSession()
    if (refreshed.error) return '/account?error=password-unavailable'
  } catch {
    return '/account?error=password-unavailable'
  }
  return '/account?password=ok'
}
