import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { validatePreferences } from './preferences.ts'

describe('validatePreferences', () => {
  it('acepta valores válidos y normaliza mayúsculas/minúsculas', () => {
    assert.deepEqual(validatePreferences({ locale: 'EN', country: 'ar', currency: 'ars' }), {
      ok: true,
      value: { locale: 'en', country: 'AR', currency: 'ARS' },
    })
  })

  it('país y moneda vacíos o ausentes quedan en null; el idioma por defecto es es', () => {
    assert.deepEqual(validatePreferences({ country: '  ', currency: '' }), {
      ok: true,
      value: { locale: 'es', country: null, currency: null },
    })
    assert.deepEqual(validatePreferences({ locale: 'es', country: null }), {
      ok: true,
      value: { locale: 'es', country: null, currency: null },
    })
  })

  it('rechaza idiomas, países y monedas inválidos', () => {
    for (const bad of [
      { locale: 'fr' },
      { country: 'ARG' },
      { country: 'A1' },
      { currency: 'AR' },
      { currency: 'PESOS' },
      { country: 5 },
      { currency: ['ARS'] },
      null,
      'x',
      [],
    ]) {
      assert.equal(validatePreferences(bad).ok, false, JSON.stringify(bad))
    }
  })
})
