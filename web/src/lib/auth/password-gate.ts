// Decide si hay que mandar a elegir contraseña (docs/cuenta-con-contrasena.md). Puro: lo usa src/proxy.ts.
// Solo mira solicitudes GET/HEAD de páginas: los POST (Server Actions, como cerrar sesión) pasan siempre.

/** `user_metadata.password_set` del token; solo `true` cuenta. Sin la marca la persona debe elegir una contraseña. */
export function getPasswordSet(claims: unknown): boolean {
  if (claims === null || typeof claims !== 'object') return false
  const metadata = (claims as { user_metadata?: unknown }).user_metadata
  if (metadata === null || typeof metadata !== 'object') return false
  return (metadata as { password_set?: unknown }).password_set === true
}

const PAGE_METHODS = new Set(['GET', 'HEAD'])
const EXCLUDED_EXACT = new Set(['/elegir-contrasena'])
const EXCLUDED_PREFIXES = ['/auth/', '/api/', '/_next/']

export function needsPasswordSetup(input: { method: string; hasSession: boolean; passwordSet: boolean; pathname: string }): boolean {
  if (!input.hasSession || input.passwordSet) return false
  if (!PAGE_METHODS.has(input.method.toUpperCase())) return false
  if (EXCLUDED_EXACT.has(input.pathname)) return false
  return !EXCLUDED_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))
}

const LINK_METHODS = new Set(['otp', 'magiclink', 'recovery'])
/** Ventana en que un ingreso por enlace permite elegir contraseña sin conocer la actual (recuperación). */
export const LINK_LOGIN_WINDOW_SECONDS = 15 * 60

/**
 * ¿La sesión nació de un enlace del correo hace poco? Sale del claim `amr` del token ya validado (no de algo que la persona controle).
 * Es lo que autoriza fijar una contraseña nueva sin la actual cuando se olvidó (docs/cuenta-con-contrasena.md).
 */
export function hasRecentLinkLogin(claims: unknown, nowSeconds: number): boolean {
  if (claims === null || typeof claims !== 'object') return false
  const amr = (claims as { amr?: unknown }).amr
  if (!Array.isArray(amr)) return false
  return amr.some((entry) => {
    if (entry === null || typeof entry !== 'object') return false
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown }
    return (
      typeof method === 'string' &&
      LINK_METHODS.has(method) &&
      typeof timestamp === 'number' &&
      nowSeconds - timestamp <= LINK_LOGIN_WINDOW_SECONDS
    )
  })
}

/** Sin contraseña (sin marca) siempre se puede elegir; con ella, solo tras un ingreso reciente por enlace. */
export function canChoosePassword(claims: unknown, nowSeconds: number): boolean {
  return !getPasswordSet(claims) || hasRecentLinkLogin(claims, nowSeconds)
}
