import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildForecastUrl, clearWeatherCache, fetchWeather, searchPlaces, type FetchLike } from './open-meteo.ts'
import { parseCoords } from './coords.ts'
import { WeatherError } from './types.ts'

const current = {
  temperature_2m: 18,
  apparent_temperature: 17,
  relative_humidity_2m: 60,
  precipitation: 0.2,
  weather_code: 61,
  is_day: 0,
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const coords = { latitude: -34.6, longitude: -58.4 }

function mock(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init)
  }
  return { calls, fetchImpl }
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof WeatherError)
    assert.ok(!/-?\d+\.\d|api\.open-meteo|http/.test(e.message), `mensaje filtra datos: ${e.message}`)
    return e.code
  }
  throw new Error('no lanzó')
}

describe('fetchWeather', () => {
  beforeEach(() => clearWeatherCache())

  it('URL canónica con coords redondeadas y revalidate', async () => {
    const m = mock(() => json({ current }))
    const rounded = parseCoords({ latitude: -34.6037, longitude: -58.3816 })!
    const w = await fetchWeather(rounded, { fetchImpl: m.fetchImpl })
    assert.equal(w.weatherCode, 61)
    assert.equal(
      m.calls[0].url,
      'https://api.open-meteo.com/v1/forecast?latitude=-34.6&longitude=-58.4&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day&timezone=auto',
    )
    assert.deepEqual((m.calls[0].init as { next?: unknown }).next, { revalidate: 1800 })
    assert.ok(m.calls[0].init?.signal)
    assert.equal(buildForecastUrl({ latitude: 0, longitude: 10 }).includes('latitude=0.0&longitude=10.0'), true)
  })

  it('segunda llamada dentro de 30 min no hace fetch; tras 30 min sí', async () => {
    let t = 1_000
    const now = () => t
    const m = mock(() => json({ current }))
    await fetchWeather(coords, { fetchImpl: m.fetchImpl, now })
    t += 30 * 60 * 1000 - 1
    await fetchWeather(coords, { fetchImpl: m.fetchImpl, now })
    assert.equal(m.calls.length, 1)
    t += 1
    await fetchWeather(coords, { fetchImpl: m.fetchImpl, now })
    assert.equal(m.calls.length, 2)
  })

  it('claves distintas por coordenadas', async () => {
    const m = mock(() => json({ current }))
    await fetchWeather(coords, { fetchImpl: m.fetchImpl })
    await fetchWeather({ latitude: 40.4, longitude: -3.7 }, { fetchImpl: m.fetchImpl })
    assert.equal(m.calls.length, 2)
  })

  it('los errores no se cachean', async () => {
    let fail = true
    const m = mock(() => (fail ? json({}, 500) : json({ current })))
    assert.equal(await code(fetchWeather(coords, { fetchImpl: m.fetchImpl })), 'unavailable')
    fail = false
    await fetchWeather(coords, { fetchImpl: m.fetchImpl })
    assert.equal(m.calls.length, 2)
  })

  it('HTTP 500 y 429 son unavailable', async () => {
    for (const status of [500, 429]) {
      const m = mock(() => json({}, status))
      assert.equal(await code(fetchWeather(coords, { fetchImpl: m.fetchImpl })), 'unavailable')
      assert.equal(m.calls.length, 1) // sin reintentos
    }
  })

  it('JSON malformado e inválido son invalid_response', async () => {
    assert.equal(await code(fetchWeather(coords, { fetchImpl: mock(() => new Response('<html>')).fetchImpl })), 'invalid_response')
    const out = { current: { ...current, relative_humidity_2m: 500 } }
    assert.equal(await code(fetchWeather(coords, { fetchImpl: mock(() => json(out)).fetchImpl })), 'invalid_response')
  })

  it('timeout y error de red', async () => {
    const t = mock(() => Promise.reject(new DOMException('x', 'TimeoutError')))
    assert.equal(await code(fetchWeather(coords, { fetchImpl: t.fetchImpl })), 'timeout')
    const n = mock(() => Promise.reject(new TypeError('fetch failed http://api.open-meteo.com?latitude=-34.6')))
    assert.equal(await code(fetchWeather(coords, { fetchImpl: n.fetchImpl })), 'unavailable')
  })

  it('el mensaje no contiene lat/lon', async () => {
    const m = mock(() => json({}, 500))
    await assert.rejects(fetchWeather(coords, { fetchImpl: m.fetchImpl }), (e: Error) => {
      assert.equal(e.message, 'weather:unavailable')
      assert.ok(!e.message.includes('34.6') && !e.message.includes('58.4'))
      return true
    })
  })
})

describe('searchPlaces', () => {
  it('arma la URL, usa no-store y parsea', async () => {
    const m = mock(() => json({ results: [{ name: 'Lima', admin1: 'Lima', country: 'Perú', latitude: -12.04, longitude: -77.03 }] }))
    const r = await searchPlaces('São Paulo & co', { fetchImpl: m.fetchImpl })
    assert.equal(
      m.calls[0].url,
      'https://geocoding-api.open-meteo.com/v1/search?name=S%C3%A3o%20Paulo%20%26%20co&count=5&language=es&format=json',
    )
    assert.equal(m.calls[0].init?.cache, 'no-store')
    assert.deepEqual(r, [{ label: 'Lima, Lima, Perú', latitude: -12, longitude: -77 }])
  })
  it('sin resultados devuelve []', async () => {
    assert.deepEqual(await searchPlaces('zzzzzz', { fetchImpl: mock(() => json({ generationtime_ms: 1 })).fetchImpl }), [])
  })
  it('no cachea: dos llamadas, dos fetch', async () => {
    const m = mock(() => json({}))
    await searchPlaces('Lima', { fetchImpl: m.fetchImpl })
    await searchPlaces('Lima', { fetchImpl: m.fetchImpl })
    assert.equal(m.calls.length, 2)
  })
  it('errores HTTP y timeout', async () => {
    assert.equal(await code(searchPlaces('Lima', { fetchImpl: mock(() => json({}, 429)).fetchImpl })), 'unavailable')
    const t = mock(() => Promise.reject(new DOMException('x', 'TimeoutError')))
    assert.equal(await code(searchPlaces('Lima', { fetchImpl: t.fetchImpl })), 'timeout')
  })
})
