// Núcleo del envío del magic link para /login y /registro. Sin `server-only` ni `@/` y con las
// dependencias inyectadas, para probar ambos modos con node:test sin red ni base. Devuelve la ruta a
// la que hay que redirigir; la Server Action la usa con `redirect()`.

import { validateNickname } from '../account/nickname.ts'

export type MagicLinkMode = 'login' | 'signup'

export type OtpError = { code?: string; status?: number; message?: string }

export type MagicLinkDeps = {
  signInWithOtp: (args: {
    email: string
    options: { shouldCreateUser: boolean; emailRedirectTo: string; data?: { nickname: string } }
  }) => Promise<{ error: OtpError | null }>
  /** URL base del sitio (SITE_URL en producción); null si no se puede determinar. */
  origin: string | null
  /** Solo UX: avisa antes de enviar el correo. La garantía de unicidad es el índice de la base. */
  isNicknameTaken: (key: string) => Promise<boolean>
  /** false si se superó el límite de envíos de esta IP. */
  allowRequest: () => boolean
}

const PAGE: Record<MagicLinkMode, string> = { login: '/login', signup: '/registro' }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function pageUrl(mode: MagicLinkMode, parameters: Record<string, string>) {
  return `${PAGE[mode]}?${new URLSearchParams(parameters).toString()}`
}

// Con shouldCreateUser: false, Supabase responde con error si el correo no existe. Mostrarlo como
// "no disponible" delataría qué correos están registrados, así que en login se trata como envío normal.
function isUnknownUserError(error: OtpError) {
  return error.code === 'otp_disabled' || (error.status === 422 && /signups? not allowed/i.test(error.message ?? ''))
}

/** Nunca incluye el correo en la URL de vuelta: solo el apodo, que es público. */
export async function sendMagicLink(
  mode: MagicLinkMode,
  input: { email: unknown; nickname?: unknown },
  deps: MagicLinkDeps,
): Promise<string> {
  const rawNickname = typeof input.nickname === 'string' ? input.nickname.trim() : ''
  const keepNickname: Record<string, string> = mode === 'signup' && rawNickname ? { nickname: rawNickname.slice(0, 40) } : {}

  if (!deps.allowRequest()) return pageUrl(mode, { error: 'rate', ...keepNickname })

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) {
    return pageUrl(mode, { error: 'email', ...keepNickname })
  }

  let nickname: string | undefined
  if (mode === 'signup') {
    const validated = validateNickname(input.nickname)
    if (!validated.ok) {
      return pageUrl(mode, { error: validated.error === 'reserved' ? 'nickname-reserved' : 'nickname', ...keepNickname })
    }
    if (await deps.isNicknameTaken(validated.key)) {
      return pageUrl(mode, { error: 'nickname-taken', ...keepNickname })
    }
    nickname = validated.nickname
  }

  if (!deps.origin) return pageUrl(mode, { error: 'request', ...keepNickname })

  const { error } = await deps.signInWithOtp({
    email,
    options: {
      shouldCreateUser: mode === 'signup',
      emailRedirectTo: new URL('/auth/confirm', deps.origin).toString(),
      ...(nickname ? { data: { nickname } } : {}),
    },
  })

  if (error && !(mode === 'login' && isUnknownUserError(error))) {
    return pageUrl(mode, { error: 'unavailable', ...keepNickname })
  }

  return pageUrl(mode, { sent: '1' })
}
