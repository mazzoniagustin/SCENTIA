import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { LONGEVITY_LABELS, SILLAGE_LABELS, scaleLabel, scalePercent, shares } from './community.ts'

describe('scaleLabel', () => {
  it('redondea a la posición más cercana y acota los extremos', () => {
    assert.equal(scaleLabel(3.37, LONGEVITY_LABELS), 'Moderada')
    assert.equal(scaleLabel(3.5, LONGEVITY_LABELS), 'Larga')
    assert.equal(scaleLabel(0, LONGEVITY_LABELS), 'Muy débil')
    assert.equal(scaleLabel(9, SILLAGE_LABELS), 'Enorme')
  })
})

describe('scalePercent', () => {
  it('1 = 0 %, máximo = 100 %', () => {
    assert.equal(scalePercent(1, 5), 0)
    assert.equal(scalePercent(3, 5), 50)
    assert.equal(scalePercent(5, 5), 100)
    assert.equal(scalePercent(2.5, 4), 50)
    assert.equal(scalePercent(7, 5), 100)
  })
})

describe('shares', () => {
  it('reparte en porcentajes y tolera cero votos', () => {
    assert.deepEqual(shares({ day: 75, night: 25 }), { day: 75, night: 25 })
    assert.deepEqual(shares({ a: 0, b: 0 }), { a: 0, b: 0 })
  })
})
