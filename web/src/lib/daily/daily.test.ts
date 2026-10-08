import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { dayKey, hashString, hemisphereForCountry, pickIndex, seasonFor } from './daily.ts'

// Mediodía UTC: el día local es el mismo en Buenos Aires (UTC-3) y en el hemisferio norte.
const at = (iso: string) => new Date(`${iso}T15:00:00Z`)

describe('hemisphereForCountry', () => {
  it('reconoce el sur y el norte; sin país usa el sur por defecto', () => {
    assert.equal(hemisphereForCountry('AR'), 'south')
    assert.equal(hemisphereForCountry('ar'), 'south')
    assert.equal(hemisphereForCountry('ES'), 'north')
    assert.equal(hemisphereForCountry('MX'), 'north')
    assert.equal(hemisphereForCountry(null), 'south')
    assert.equal(hemisphereForCountry(undefined), 'south')
  })
})

describe('seasonFor', () => {
  it('hemisferio norte: estaciones meteorológicas', () => {
    assert.equal(seasonFor(at('2026-01-15'), 'north'), 'invierno')
    assert.equal(seasonFor(at('2026-04-15'), 'north'), 'primavera')
    assert.equal(seasonFor(at('2026-07-15'), 'north'), 'verano')
    assert.equal(seasonFor(at('2026-10-08'), 'north'), 'otoño')
    assert.equal(seasonFor(at('2026-12-15'), 'north'), 'invierno')
  })

  it('hemisferio sur: invertidas (hoy en Argentina es primavera)', () => {
    assert.equal(seasonFor(at('2026-10-08'), 'south'), 'primavera')
    assert.equal(seasonFor(at('2026-01-15'), 'south'), 'verano')
    assert.equal(seasonFor(at('2026-07-15'), 'south'), 'invierno')
    assert.equal(seasonFor(at('2026-04-15'), 'south'), 'otoño')
  })

  it('los límites de mes cambian de estación', () => {
    assert.equal(seasonFor(at('2026-02-28'), 'north'), 'invierno')
    assert.equal(seasonFor(at('2026-03-01'), 'north'), 'primavera')
    assert.equal(seasonFor(at('2026-11-30'), 'north'), 'otoño')
    assert.equal(seasonFor(at('2026-12-01'), 'north'), 'invierno')
  })
})

describe('dayKey', () => {
  it('cambia a medianoche local, no a medianoche UTC', () => {
    // 02:30 UTC del 9/10 es 23:30 del 8/10 en Buenos Aires (UTC-3).
    assert.equal(dayKey(new Date('2026-10-09T02:30:00Z')), '2026-10-08')
    assert.equal(dayKey(new Date('2026-10-09T03:30:00Z')), '2026-10-09')
    assert.equal(dayKey(new Date('2026-10-09T02:30:00Z'), 'UTC'), '2026-10-09')
  })

  it('el mes local define la estación (1/12 a las 01:00 UTC todavía es 30/11 en Argentina)', () => {
    const d = new Date('2026-12-01T01:00:00Z')
    assert.equal(dayKey(d), '2026-11-30')
    assert.equal(seasonFor(d, 'north'), 'otoño')
  })
})

describe('hashString / pickIndex', () => {
  it('es estable: valores conocidos de FNV-1a', () => {
    assert.equal(hashString(''), 0x811c9dc5)
    assert.equal(hashString('a'), 0xe40c292c)
  })

  it('pickIndex es determinista y queda dentro del rango', () => {
    for (const n of [1, 2, 7, 500]) {
      const i = pickIndex('2026-10-08|primavera', n)
      assert.ok(i >= 0 && i < n)
      assert.equal(i, pickIndex('2026-10-08|primavera', n))
    }
    assert.equal(pickIndex('x', 0), -1)
  })

  it('días consecutivos reparten la elección (no se queda en el mismo índice)', () => {
    const seen = new Set<number>()
    for (let day = 1; day <= 30; day++) {
      seen.add(pickIndex(`2026-10-${String(day).padStart(2, '0')}|primavera`, 800))
    }
    assert.ok(seen.size >= 28, `solo ${seen.size} índices distintos en 30 días`)
  })
})
