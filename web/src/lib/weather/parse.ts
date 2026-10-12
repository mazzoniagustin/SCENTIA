// Parseo defensivo de las respuestas de Open-Meteo. Módulo puro.
import { roundCoord } from './coords.ts'
import { WeatherError, type Place, type Weather } from './types.ts'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function num(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw new WeatherError('invalid_response')
  }
  return v
}

/** Valida `current` de /v1/forecast. Lanza WeatherError('invalid_response') ante cualquier dato fuera de rango. */
export function parseForecast(json: unknown): Weather {
  if (!isRecord(json) || !isRecord(json.current)) throw new WeatherError('invalid_response')
  const c = json.current
  const code = num(c.weather_code, 0, 999)
  const isDay = num(c.is_day, 0, 1)
  if (!Number.isInteger(code) || !Number.isInteger(isDay)) throw new WeatherError('invalid_response')
  return {
    temperatureC: num(c.temperature_2m, -60, 60),
    apparentTemperatureC: num(c.apparent_temperature, -60, 60),
    humidityPct: num(c.relative_humidity_2m, 0, 100),
    precipitationMm: num(c.precipitation, 0, Number.MAX_SAFE_INTEGER),
    weatherCode: code,
    isDay: isDay === 1,
  }
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Valida /v1/search. Sin `results` (ciudad sin coincidencias) devuelve []. Descarta entradas inválidas. */
export function parseGeocoding(json: unknown): Place[] {
  if (!isRecord(json)) throw new WeatherError('invalid_response')
  if (json.results === undefined) return []
  if (!Array.isArray(json.results)) throw new WeatherError('invalid_response')
  const places: Place[] = []
  for (const r of json.results) {
    if (places.length >= 5) break
    if (!isRecord(r)) continue
    const { latitude, longitude } = r
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue
    const name = text(r.name)
    if (!name) continue
    const label = [name, text(r.admin1), text(r.country)].filter(Boolean).join(', ')
    places.push({ label, latitude: roundCoord(latitude), longitude: roundCoord(longitude) })
  }
  return places
}
