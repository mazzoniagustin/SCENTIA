import { NextResponse } from 'next/server'
import { getSessionDbUserId } from '@/lib/auth/db-user'
import { limitRequest } from '@/lib/api-guard'
import { limitAction } from '@/lib/rate-limit'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export function outfitJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

/**
 * Pasos comunes de los endpoints de "¿Qué me pongo hoy?", en este orden: límite por IP, Content-Type JSON,
 * cuerpo JSON, sesión (401) y límite por persona (429). Devuelve el cuerpo y el id, o la respuesta de error.
 */
export async function guardOutfitRequest(
  request: Request,
  name: string,
  perUserLimit: number,
): Promise<{ ok: true; userId: string; body: unknown } | { ok: false; response: NextResponse }> {
  const limited = limitRequest(request, `${name}-ip`, 60)
  if (limited) return { ok: false, response: limited }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return { ok: false, response: outfitJson({ error: 'Content-Type debe ser application/json' }, 415) }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { ok: false, response: outfitJson({ error: 'Cuerpo inválido' }, 400) }
  }

  const userId = await getSessionDbUserId()
  if (!userId) return { ok: false, response: outfitJson({ error: 'Necesitás iniciar sesión' }, 401) }

  const limit = limitAction(name, userId, { limit: perUserLimit, windowMs: 60_000 })
  if (!limit.ok) {
    return {
      ok: false,
      response: outfitJson({ error: 'Demasiadas solicitudes, probá de nuevo en unos segundos' }, 429, {
        'Retry-After': String(limit.retryAfterSeconds),
      }),
    }
  }
  return { ok: true, userId, body }
}
