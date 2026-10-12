import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseCoords, parsePlaceQuery, roundCoord } from './coords.ts'

describe('roundCoord', () => {
  it('redondea a 1 decimal', () => {
    assert.equal(roundCoord(-34.6037), -34.6)
    assert.equal(roundCoord(58.449), 58.4)
    assert.equal(roundCoord(-0.04), 0)
    assert.ok(Object.is(roundCoord(-0.04), 0))
  })
})

describe('parseCoords', () => {
  it('acepta y redondea', () => {
    assert.deepEqual(parseCoords({ latitude: -34.6037, longitude: -58.3816 }), { latitude: -34.6, longitude: -58.4 })
  })
  it('acepta los bordes', () => {
    assert.ok(parseCoords({ latitude: 90, longitude: 180 }))
    assert.ok(parseCoords({ latitude: -90, longitude: -180 }))
  })
  it('rechaza fuera de rango, no finitos y tipos inválidos', () => {
    for (const bad of [
      { latitude: 90.1, longitude: 0 },
      { latitude: 0, longitude: -180.1 },
      { latitude: NaN, longitude: 0 },
      { latitude: 0, longitude: Infinity },
      { latitude: '1', longitude: 2 },
      { latitude: 1 },
      null,
      undefined,
      'x',
      42,
    ]) assert.equal(parseCoords(bad), null)
  })
})

describe('parsePlaceQuery', () => {
  it('recorta y valida largo', () => {
    assert.equal(parsePlaceQuery('  Córdoba '), 'Córdoba')
    assert.equal(parsePlaceQuery('ab'), 'ab')
    assert.equal(parsePlaceQuery('a'), null)
    assert.equal(parsePlaceQuery(' a '), null)
    assert.equal(parsePlaceQuery('x'.repeat(80)), 'x'.repeat(80))
    assert.equal(parsePlaceQuery('x'.repeat(81)), null)
  })
  it('rechaza controles y no strings', () => {
    assert.equal(parsePlaceQuery('Bu\nenos'), null)
    assert.equal(parsePlaceQuery('Bu\u0000enos'), null)
    assert.equal(parsePlaceQuery(123), null)
    assert.equal(parsePlaceQuery(null), null)
  })
})
