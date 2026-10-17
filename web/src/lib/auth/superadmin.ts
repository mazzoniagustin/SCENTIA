import 'server-only'

import { isSuperadmin } from '@/lib/admin/superadmin'
import { createClient } from '@/lib/supabase/server'

/**
 * Devuelve el correo de la persona con sesión si es superadmin (lista SUPERADMIN_EMAILS, correo confirmado), o null.
 * Se valida con `getUser()` (consulta a Supabase), no con el token solo.
 */
export async function getSuperadminOrNull(): Promise<{ email: string } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.email) return null
  const email = data.user.email
  return isSuperadmin({ email, emailConfirmed: Boolean(data.user.email_confirmed_at) }) ? { email } : null
}
