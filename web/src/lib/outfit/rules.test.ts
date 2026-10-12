import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCORD_TRANSLATIONS } from '../../../scripts/accord-translations.ts'
import { accordAffinity, CLOYING_ACCORDS, COLD_ACCORDS, HOT_ACCORDS, isCloyingAccord } from './rules.ts'

describe('reglas de acordes', () => {
  it('todos los nombres existen en el catálogo de acordes', () => {
    const catalog = new Set(Object.values(ACCORD_TRANSLATIONS))
    for (const set of [HOT_ACCORDS, COLD_ACCORDS, CLOYING_ACCORDS]) {
      assert.deepEqual([...set].filter((n) => !catalog.has(n)), [])
    }
  })

  it('calor y frío no comparten acordes', () => {
    assert.deepEqual([...HOT_ACCORDS].filter((n) => COLD_ACCORDS.has(n)), [])
  })

  it('calor favorece frescos y castiga densos', () => {
    assert.equal(accordAffinity('cítrico', 'hot'), 1)
    assert.equal(accordAffinity('oud', 'hot'), 0)
  })

  it('frío favorece cálidos y castiga frescos', () => {
    assert.equal(accordAffinity('ámbar', 'cold'), 1)
    assert.equal(accordAffinity('marino', 'cold'), 0)
  })

  it('banda templada es neutra para todo', () => {
    for (const n of ['cítrico', 'oud', 'floral', 'metálico']) assert.equal(accordAffinity(n, 'mild'), 0.5)
  })

  it('acordes sin regla explícita se derivan de las estaciones o son neutros', () => {
    assert.ok(accordAffinity('terroso', 'cold') > 0.5)
    assert.ok(accordAffinity('terroso', 'hot') < 0.5)
    assert.ok(accordAffinity('coco', 'hot') > 0.5)
    assert.equal(accordAffinity('metálico', 'hot'), 0.5)
    assert.equal(accordAffinity('metálico', 'cold'), 0.5)
  })

  it('las afinidades están en [0, 1]', () => {
    for (const n of Object.values(ACCORD_TRANSLATIONS)) {
      for (const band of ['hot', 'cold', 'mild'] as const) {
        const a = accordAffinity(n, band)
        assert.ok(a >= 0 && a <= 1, `${n}/${band}`)
      }
    }
  })

  it('isCloyingAccord', () => {
    assert.equal(isCloyingAccord('caramelo'), true)
    assert.equal(isCloyingAccord('cítrico'), false)
  })
})
