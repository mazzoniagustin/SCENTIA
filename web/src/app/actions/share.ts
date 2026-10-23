'use server'

import { revalidatePath } from 'next/cache'
import { getAuthenticatedUserOrNull } from '@/lib/auth/require-user'
import { RATE_LIMIT_MESSAGE, limitAction } from '@/lib/rate-limit'
import { logServerError } from '@/lib/log'
import { createOrReplaceShare, revokeShare } from '@/lib/share/data'
import { parseShareScope } from '@/lib/share/view'
import { shareInputFromFormData, type ShareFormState } from '@/lib/share/form'

// Gestión de links: 10 por minuto por persona. La persona sale siempre de la sesión.
const shareAllowed = (userId: string) => limitAction('share', userId, { limit: 10, windowMs: 60_000 }).ok

// Crea (o regenera) el link de una lista. Es la única vez que el token sale en claro; nunca se registra en logs.
export async function createShareAction(_previous: ShareFormState, formData: FormData): Promise<ShareFormState> {
  const input = shareInputFromFormData(formData)
  if (!input) return { status: 'error', message: 'No pudimos crear el link. Probá de nuevo en un momento.' }

  let token: string
  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user) return { status: 'error', message: 'Tu sesión venció. Volvé a ingresar para compartir tu colección.' }

    if (!shareAllowed(user.id)) return { status: 'error', message: RATE_LIMIT_MESSAGE }

    ;({ token } = await createOrReplaceShare(user.id, input.scope, input.showRatings))
  } catch (error) {
    logServerError('share/create', error)
    return { status: 'error', message: 'No pudimos crear el link. Probá de nuevo en un momento.' }
  }

  revalidatePath('/mi-coleccion')
  return { status: 'success', message: 'Link creado. Copialo ahora: no lo vas a poder ver de nuevo.', token }
}

// Deja de compartir una lista. Idempotente: revocar algo ya revocado no es un error.
export async function revokeShareAction(_previous: ShareFormState, formData: FormData): Promise<ShareFormState> {
  const scope = parseShareScope(formData.get('scope'))
  if (!scope) return { status: 'error', message: 'No pudimos dejar de compartir. Probá de nuevo en un momento.' }

  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user) return { status: 'error', message: 'Tu sesión venció. Volvé a ingresar para dejar de compartir.' }

    if (!shareAllowed(user.id)) return { status: 'error', message: RATE_LIMIT_MESSAGE }

    await revokeShare(user.id, scope)
  } catch (error) {
    logServerError('share/revoke', error)
    return { status: 'error', message: 'No pudimos dejar de compartir. Probá de nuevo en un momento.' }
  }

  revalidatePath('/mi-coleccion')
  return { status: 'success', message: 'Dejaste de compartir esta lista.' }
}
