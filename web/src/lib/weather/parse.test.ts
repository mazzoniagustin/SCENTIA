import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseForecast, parseGeocoding } from './parse.ts'
import { WeatherError } from './types.ts'

const current = {
  temperature_2m: 21.3,
  apparent_temperature: 20.1,
  relative_humidity_2m: 55,
  precipitation: 0,
  weather_code: 3,
  is_day: 1,
}
const bad = (c: Record<string, unknown>) => () => parseForecast({ current: { ...current, ...c } })
const invalid = (e: unknown) => e instanceof WeatherError && e.code === 'invalid_response'

describe('parseForecast', () => {
  it('parsea una respuesta válida', () => {
    assert.deepEqual(parseForecast({ current, extra: 1 }), {
      temperatureC: 21.3,
      apparentTemperatureC: 20.1,
      humidityPct: 55,
      precipitationMm: 0,
      weatherCode: 3,
      isDay: true,
    })
    assert.equal(parseForecast({ current: { ...current, is_day: 0 } }).isDay, false)
  })
  it('rechaza estructura inválida', () => {
    for (const j of [null, 'x', [], {}, { current: null }, { current: [] }]) {
      assert.throws(() => parseForecast(j), invalid)
    }
  })
  it('valida rangos y tipos', () => {
    assert.throws(bad({ relative_humidity_2m: 101 }), invalid)
    assert.throws(bad({ relative_humidity_2m: -1 }), invalid)
    assert.throws(bad({ temperature_2m: 61 }), invalid)
    assert.throws(bad({ apparent_temperature: -60.5 }), invalid)
    assert.throws(bad({ precipitation: -0.1 }), invalid)
    assert.throws(bad({ weather_code: 1.5 }), invalid)
    assert.throws(bad({ is_day: 2 }), invalid)
    assert.throws(bad({ is_day: 0.5 }), invalid)
    assert.throws(bad({ temperature_2m: '20' }), invalid)
    assert.throws(bad({ temperature_2m: null }), invalid)
    assert.throws(bad({ precipitation: undefined }), invalid)
    assert.throws(bad({ temperature_2m: NaN }), invalid)
  })
  it('acepta bordes', () => {
    assert.doesNotThrow(bad({ temperature_2m: -60, apparent_temperature: 60, relative_humidity_2m: 0 }))
  })
})

describe('parseGeocoding', () => {
  it('arma etiqueta y redondea', () => {
    const r = parseGeocoding({
      results: [{ name: 'Córdoba', admin1: 'Córdoba', country: 'Argentina', latitude: -31.4135, longitude: -64.18105 }],
    })
    assert.deepEqual(r, [{ label: 'Córdoba, Córdoba, Argentina', latitude: -31.4, longitude: -64.2 }])
  })
  it('tolera campos ausentes', () => {
    const r = parseGeocoding({ results: [{ name: 'X', country: 'Y', latitude: 1, longitude: 2 }, { name: 'Z', latitude: 3, longitude: 4 }] })
    assert.deepEqual(r.map((p) => p.label), ['X, Y', 'Z'])
  })
  it('sin results devuelve []', () => {
    assert.deepEqual(parseGeocoding({ generationtime_ms: 0.5 }), [])
    assert.deepEqual(parseGeocoding({ results: [] }), [])
  })
  it('máximo 5 y descarta inválidos', () => {
    const results = Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, latitude: i, longitude: i }))
    assert.equal(parseGeocoding({ results }).length, 5)
    assert.deepEqual(parseGeocoding({ results: [{ name: 'A', latitude: 95, longitude: 0 }, { latitude: 1, longitude: 1 }, 'x', null] }), [])
  })
  it('estructura inválida lanza', () => {
    assert.throws(() => parseGeocoding(null), invalid)
    assert.throws(() => parseGeocoding({ results: 'x' }), invalid)
  })
})
