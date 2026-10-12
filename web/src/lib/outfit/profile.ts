// Perfil del clima para "¿Qué me pongo hoy?". Módulo puro: sin fetch ni Prisma.
// La banda de temperatura usa la temperatura APARENTE (la que siente la persona).

import type { Weather } from '../weather/types.ts'
import type { TemperatureBand, WeatherProfile } from './types.ts'

/** Por debajo de este valor (°C aparentes) la banda es 'cold'. */
export const COLD_BELOW_C = 15
/** Desde este valor (°C aparentes) la banda es 'hot'. */
export const HOT_FROM_C = 25
/** Humedad relativa (%) desde la cual se considera ambiente húmedo. */
export const HUMID_FROM_PCT = 70
/** Precipitación (mm) desde la cual se considera lluvia. */
export const WET_MIN_PRECIPITATION_MM = 0.1

/** Códigos WMO con agua: llovizna, lluvia, nieve, chubascos y tormenta. */
export const WET_WEATHER_CODES: ReadonlySet<number> = new Set([
  ...range(51, 67),
  ...range(71, 77),
  ...range(80, 82),
  ...range(85, 86),
  ...range(95, 99),
])

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

export function temperatureBand(apparentTemperatureC: number): TemperatureBand {
  if (apparentTemperatureC < COLD_BELOW_C) return 'cold'
  if (apparentTemperatureC >= HOT_FROM_C) return 'hot'
  return 'mild'
}

export function buildWeatherProfile(w: Weather): WeatherProfile {
  return {
    band: temperatureBand(w.apparentTemperatureC),
    humid: w.humidityPct >= HUMID_FROM_PCT,
    wet: w.precipitationMm >= WET_MIN_PRECIPITATION_MM || WET_WEATHER_CODES.has(w.weatherCode),
    isDay: w.isDay,
    temperatureC: w.temperatureC,
    apparentTemperatureC: w.apparentTemperatureC,
    humidityPct: w.humidityPct,
    precipitationMm: w.precipitationMm,
  }
}
