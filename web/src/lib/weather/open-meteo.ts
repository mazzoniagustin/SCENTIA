// Cliente de Open-Meteo (clima y geocodificación). Sin 'server-only': los módulos equivalentes de src/lib
// (ttl-cache, rate-limit, shared-cache) no lo usan y así se puede testear con node:test.
// Los errores son WeatherError con mensaje fijo: nunca incluyen URL ni coordenadas.
import { createTtlCache } from '../ttl-cache.ts'
import { parseForecast, parseGeocoding } from './parse.ts'
import { WeatherError, type Place, type RoundedCoords, type Weather } from './types.ts'

const TIMEOUT_MS = 3000
const CACHE_TTL_MS = 30 * 60 * 1000
const REVALIDATE_S = 1800

export type FetchLike = (url: string, init?: RequestInit & { next?: { revalidate: number } }) => Promise<Response>
export type WeatherDeps = { fetchImpl?: FetchLike; now?: () => number }

/** URL canónica: depende solo de las coordenadas ya redondeadas, con orden fijo de parámetros. */
export function buildForecastUrl({ latitude, longitude }: RoundedCoords): string {
  return (
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${latitude.toFixed(1)}&longitude=${longitude.toFixed(1)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day' +
    '&timezone=auto'
  )
}

async function getJson(fetchImpl: FetchLike, url: string, init: Parameters<FetchLike>[1]): Promise<unknown> {
  let res: Response
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    const name = (e as { name?: string } | null)?.name
    throw new WeatherError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unavailable')
  }
  if (!res.ok) throw new WeatherError('unavailable')
  try {
    return await res.json()
  } catch (e) {
    const name = (e as { name?: string } | null)?.name
    throw new WeatherError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'invalid_response')
  }
}

// Segunda capa por clave `lat,lon`, para no depender solo del Data Cache de Next. Los errores no se cachean.
const weatherCache = createTtlCache<Weather>({ ttlMs: CACHE_TTL_MS })
const cacheByNow = new Map<() => number, ReturnType<typeof createTtlCache<Weather>>>()

function cacheFor(now?: () => number) {
  if (!now) return weatherCache
  let c = cacheByNow.get(now)
  if (!c) {
    c = createTtlCache<Weather>({ ttlMs: CACHE_TTL_MS, now })
    cacheByNow.set(now, c)
  }
  return c
}

/** Clima actual para coordenadas ya redondeadas (usar parseCoords antes). */
export function fetchWeather(coords: RoundedCoords, deps: WeatherDeps = {}): Promise<Weather> {
  const fetchImpl = deps.fetchImpl ?? (fetch as FetchLike)
  const key = `${coords.latitude.toFixed(1)},${coords.longitude.toFixed(1)}`
  return cacheFor(deps.now).getOrCompute(key, async () =>
    parseForecast(await getJson(fetchImpl, buildForecastUrl(coords), { next: { revalidate: REVALIDATE_S } })),
  )
}

/** Busca ciudades (máx. 5). Sin caché: la consulta es texto libre del usuario. */
export async function searchPlaces(query: string, deps: WeatherDeps = {}): Promise<Place[]> {
  const fetchImpl = deps.fetchImpl ?? (fetch as FetchLike)
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(query)}&count=5&language=es&format=json`
  return parseGeocoding(await getJson(fetchImpl, url, { cache: 'no-store' }))
}

/** Solo para tests: vacía la caché por defecto. */
export function clearWeatherCache(): void {
  weatherCache.clear()
  cacheByNow.clear()
}
