import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import type { Weather } from '../weather/types.ts'
import { buildWeatherProfile, COLD_BELOW_C, HOT_FROM_C, HUMID_FROM_PCT, WET_MIN_PRECIPITATION_MM } from './profile.ts'

const weather = (over: Partial<Weather> = {}): Weather => ({
  temperatureC: 20,
  apparentTemperatureC: 20,
  humidityPct: 50,
  precipitationMm: 0,
  weatherCode: 0,
  isDay: true,
  ...over,
})

describe('buildWeatherProfile', () => {
  it('la banda usa la temperatura aparente, no la real', () => {
    assert.equal(buildWeatherProfile(weather({ temperatureC: 30, apparentTemperatureC: 10 })).band, 'cold')
    assert.equal(buildWeatherProfile(weather({ temperatureC: 10, apparentTemperatureC: 30 })).band, 'hot')
  })

  it('respeta los límites: <15 frío, 15..24.9 templado, >=25 calor', () => {
    const band = (t: number) => buildWeatherProfile(weather({ apparentTemperatureC: t })).band
    assert.equal(band(COLD_BELOW_C - 0.1), 'cold')
    assert.equal(band(COLD_BELOW_C), 'mild')
    assert.equal(band(HOT_FROM_C - 0.1), 'mild')
    assert.equal(band(HOT_FROM_C), 'hot')
  })

  it('humedad desde 70 %', () => {
    assert.equal(buildWeatherProfile(weather({ humidityPct: HUMID_FROM_PCT - 1 })).humid, false)
    assert.equal(buildWeatherProfile(weather({ humidityPct: HUMID_FROM_PCT })).humid, true)
  })

  it('wet por precipitación o por código WMO de agua', () => {
    assert.equal(buildWeatherProfile(weather()).wet, false)
    assert.equal(buildWeatherProfile(weather({ precipitationMm: WET_MIN_PRECIPITATION_MM })).wet, true)
    assert.equal(buildWeatherProfile(weather({ precipitationMm: 0.09 })).wet, false)
    for (const code of [51, 61, 67, 71, 77, 80, 82, 85, 86, 95, 99]) {
      assert.equal(buildWeatherProfile(weather({ weatherCode: code })).wet, true, `código ${code}`)
    }
    for (const code of [0, 3, 45, 48, 68, 78, 83, 90]) {
      assert.equal(buildWeatherProfile(weather({ weatherCode: code })).wet, false, `código ${code}`)
    }
  })

  it('copia el resto de los campos', () => {
    const p = buildWeatherProfile(weather({ temperatureC: 18, humidityPct: 40, precipitationMm: 0, isDay: false }))
    assert.equal(p.isDay, false)
    assert.equal(p.temperatureC, 18)
    assert.equal(p.humidityPct, 40)
    assert.equal(p.precipitationMm, 0)
  })
})
