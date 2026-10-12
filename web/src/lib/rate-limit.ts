// Limitador de tasa de ventana fija, en memoria. Frena abuso casual de los endpoints públicos que
// consultan la base. Limitación conocida: en un entorno serverless cada instancia lleva su propio
// contador, así que es un freno parcial; para una protección real hay que sumar las reglas del firewall
// de la plataforma (p. ej. Vercel Firewall) o un contador compartido.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number }

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  const now = options.now ?? Date.now()

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k)
    if (buckets.size > MAX_BUCKETS) buckets.clear() // sigue lleno de ventanas vigentes: se reinicia antes que crecer sin límite
  }

  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return { ok: true, remaining: options.limit - 1 }
  }
  if (current.count >= options.limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }
  current.count += 1
  return { ok: true, remaining: options.limit - current.count }
}

export const RATE_LIMIT_MESSAGE = 'Hiciste muchos cambios seguidos. Esperá un minuto y volvé a intentar.'

/**
 * Límite por acción y por persona para Server Actions: clave `action:<name>:<userId>`. Pasá el id de
 * la sesión; solo si no hay usuario usá la IP (clientIp) como identificador. No lanza nunca.
 * Limitación serverless: el contador vive en memoria de cada instancia, así que es un freno parcial.
 * La protección real requiere el Firewall de Vercel o un contador compartido (Redis/tabla), que
 * necesitaría una dependencia o cambio de schema y confirmación previa.
 */
export function limitAction(
  name: string,
  userId: string,
  options: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  return rateLimit(`action:${name}:${userId}`, options)
}

/** IP del cliente según el proxy de la plataforma (primer valor de x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Solo para tests. */
export function resetRateLimits() {
  buckets.clear()
}
