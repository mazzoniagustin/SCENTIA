// Caché en memoria con vencimiento (TTL) y tope de entradas, para datos que cambian solo al importar o
// publicar (lista de acordes, conteos del catálogo, ranking de similares). Cada instancia serverless tiene
// la suya, así que sirve para ahorrar consultas, no como fuente de verdad: un dato nuevo tarda como mucho un
// TTL en verse. Las solicitudes simultáneas por la misma clave comparten una sola consulta.

export type TtlCache<T> = {
  getOrCompute(key: string, compute: () => Promise<T>): Promise<T>
  clear(): void
  readonly size: number
}

export function createTtlCache<T>(options: {
  ttlMs: number
  maxEntries?: number
  now?: () => number
  /** Si devuelve false el valor se entrega pero no se guarda (ej. resultados vacíos o "no encontrado"). */
  cacheIf?: (value: T) => boolean
}): TtlCache<T> {
  const { ttlMs, maxEntries = 500 } = options
  const now = options.now ?? Date.now
  const entries = new Map<string, { value: T; expiresAt: number }>()
  const inFlight = new Map<string, Promise<T>>()

  return {
    async getOrCompute(key, compute) {
      const hit = entries.get(key)
      if (hit && hit.expiresAt > now()) return hit.value

      const pending = inFlight.get(key)
      if (pending) return pending

      const promise = compute()
        .then((value) => {
          if (options.cacheIf && !options.cacheIf(value)) return value
          if (entries.size >= maxEntries) {
            // Primero se descartan las vencidas; si sigue lleno, la más antigua (orden de inserción).
            for (const [k, e] of entries) if (e.expiresAt <= now()) entries.delete(k)
            if (entries.size >= maxEntries) entries.delete(entries.keys().next().value as string)
          }
          entries.set(key, { value, expiresAt: now() + ttlMs })
          return value
        })
        .finally(() => inFlight.delete(key)) // un error no se cachea: la próxima solicitud reintenta
      inFlight.set(key, promise)
      return promise
    },
    clear() {
      entries.clear()
      inFlight.clear()
    },
    get size() {
      return entries.size
    },
  }
}
