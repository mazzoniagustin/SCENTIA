// Quién es superadmin. Puro: sin red ni base. La lista sale de la variable de entorno SUPERADMIN_EMAILS (correos separados por
// comas, sin distinguir mayúsculas ni espacios). Sin la variable, o vacía, nadie es superadmin (cierra por defecto).
// El correo debe venir de la sesión de Supabase y estar confirmado: así nadie se hace pasar por otra persona con un correo ajeno.

export type SuperadminEnv = Record<string, string | undefined>

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

export function parseSuperadminEmails(raw: string | undefined): string[] {
  if (!raw) return []
  const emails = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => EMAIL.test(email))
  return [...new Set(emails)]
}

export function isSuperadmin(
  user: { email?: string | null; emailConfirmed?: boolean } | null | undefined,
  env: SuperadminEnv = process.env,
): boolean {
  if (!user || !user.email || user.emailConfirmed !== true) return false
  return parseSuperadminEmails(env.SUPERADMIN_EMAILS).includes(user.email.trim().toLowerCase())
}
