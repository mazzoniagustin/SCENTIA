// Contrato del clima para "¿Qué me pongo hoy?". Módulo puro: solo tipos y constantes.

/** Datos del clima actual ya validados. Nunca incluye coordenadas ni nombre de ciudad. */
export type Weather = {
  temperatureC: number
  apparentTemperatureC: number
  humidityPct: number
  precipitationMm: number
  /** Código WMO de condición del tiempo (0 = despejado). */
  weatherCode: number
  isDay: boolean
}

/** Coordenadas redondeadas a 1 decimal (~10 km). Se usan solo para consultar el clima. */
export type RoundedCoords = { latitude: number; longitude: number }

/** Resultado de buscar una ciudad. El nombre se muestra al usuario, no se guarda ni se loguea. */
export type Place = { label: string; latitude: number; longitude: number }

/** Error del clima con mensaje fijo (sin URL ni coordenadas) para que logServerError no filtre datos. */
export class WeatherError extends Error {
  readonly code: 'unavailable' | 'invalid_response' | 'timeout'

  constructor(code: 'unavailable' | 'invalid_response' | 'timeout') {
    super(`weather:${code}`)
    this.name = 'WeatherError'
    this.code = code
  }
}
