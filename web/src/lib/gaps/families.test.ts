import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCORD_TRANSLATIONS } from '../../../scripts/accord-translations.ts'
import { FAMILY_ACCORDS, FAMILY_CODES, FAMILY_LABELS, FAMILY_ORDER, familyOfAccord } from './families.ts'

describe('familias olfativas', () => {
  it('son 10, con etiqueta y en el orden declarado', () => {
    assert.equal(FAMILY_CODES.length, 10)
    assert.deepEqual([...FAMILY_ORDER], [...FAMILY_CODES])
    for (const code of FAMILY_CODES) assert.ok(FAMILY_LABELS[code])
  })

  it('todos los acordes existen en el vocabulario de acordes', () => {
    const catalog = new Set(Object.values(ACCORD_TRANSLATIONS))
    const missing = FAMILY_CODES.flatMap((code) => FAMILY_ACCORDS[code].filter((name) => !catalog.has(name)))
    assert.deepEqual(missing, [])
  })

  it('un acorde pertenece a una sola familia', () => {
    const all = FAMILY_CODES.flatMap((code) => [...FAMILY_ACCORDS[code]])
    assert.deepEqual(all.filter((name, i) => all.indexOf(name) !== i), [])
  })

  it('resuelve la familia sin importar mayúsculas ni espacios', () => {
    assert.equal(familyOfAccord(' Cítrico '), 'citrico')
    assert.equal(familyOfAccord('pachuli'), 'cuero')
    assert.equal(familyOfAccord('whisky'), 'dulce')
  })

  it('los acordes raros sin familia se ignoran', () => {
    for (const name of ['sabroso', 'cannabis', 'cera de abeja', 'alcanfor', 'plástico', 'inventado']) {
      assert.equal(familyOfAccord(name), null)
    }
  })
})
