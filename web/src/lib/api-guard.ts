import { NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'

const WINDOW_MS = 60_000

/**
 * Aplica el limitador por IP y nombre de endpoint. Devuelve la respuesta 429 si se superó el
 * límite por minuto, o null si la solicitud puede seguir.
 */
export function limitRequest(request: Request, name: string, limitPerMinute: number): NextResponse | null {
  const result = rateLimit(`${name}:${clientIp(request.headers)}`, { limit: limitPerMinute, windowMs: WINDOW_MS })
  if (result.ok) return null
  return NextResponse.json(
    { error: 'Demasiadas solicitudes, probá de nuevo en unos segundos' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  )
}
