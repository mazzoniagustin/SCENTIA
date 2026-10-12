import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeGender, normalizeSeason } from './filter-labels.ts'

describe('normalizeGender', () => {
  it('lleva los alias al valor guardado, sin importar mayúsculas', () => {
    for (const v of ['men', 'male', 'hombre', 'Hombres', 'MASCULINO', ' men ']) assert.equal(normalizeGender(v), 'masculino')
    for (const v of ['women', 'Female', 'mujer', 'mujeres', 'femenino']) assert.equal(normalizeGender(v), 'femenino')
    assert.equal(normalizeGender('Unisex'), 'unisex')
  })

  it('valor desconocido o vacío da null', () => {
    assert.equal(normalizeGender('otro'), null)
    assert.equal(normalizeGender(''), null)
    assert.equal(normalizeGender(null), null)
    assert.equal(normalizeGender(undefined), null)
  })
})

describe('normalizeSeason', () => {
  it('acepta mayúsculas y rechaza lo desconocido', () => {
    assert.equal(normalizeSeason('Verano'), 'verano')
    assert.equal(normalizeSeason('OTOÑO'), 'otoño')
    assert.equal(normalizeSeason('monzón'), null)
  })
})
