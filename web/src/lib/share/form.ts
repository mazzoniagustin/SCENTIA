// Interpreta el formulario de compartir colección y define el estado que se devuelve a la pantalla. Lógica pura.

import { parseShareScope, type ShareScope } from './view.ts'

export type ShareFormState = { status: 'idle' | 'success' | 'error'; message: string; token?: string }

export const IDLE_SHARE_STATE: ShareFormState = { status: 'idle', message: '' }

/** Devuelve null si la lista es desconocida. La wishlist nunca muestra puntuaciones. */
export function shareInputFromFormData(formData: FormData): { scope: ShareScope; showRatings: boolean } | null {
  const scope = parseShareScope(formData.get('scope'))
  if (!scope) return null
  const showRatings = scope === 'OWNED' && formData.get('showRatings') === 'on'
  return { scope, showRatings }
}
