import { unstable_cache } from 'next/cache'

// Caché compartida entre instancias (Data Cache de Next/Vercel) para agregados del catálogo que cambian solo al importar o
// publicar. Se usa DETRÁS de la caché en memoria de cada instancia: una instancia fría lee de aquí en vez de recalcular.
// Solo para funciones sin cookies ni datos personales, con resultados serializables (JSON). Los argumentos forman parte de la clave.
// Tras importar datos: `revalidateTag('catalog')` (o esperar `SHARED_TTL_SECONDS`).

export const SHARED_TTL_SECONDS = 60 * 60

export function sharedCache<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string): (...args: A) => Promise<R> {
  return unstable_cache(fn, ['scentia', key], { revalidate: SHARED_TTL_SECONDS, tags: ['catalog'] })
}
