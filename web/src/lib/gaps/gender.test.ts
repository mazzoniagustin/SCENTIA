import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  GENDER_DOMINANCE_SHARE,
  GENDER_FILTERS,
  allowedGenders,
  inferGender,
  parseGenderChoice,
  resolveGender,
} from './gender.ts'

type S = { status: string; gender?: string | null }
const own = (gender: string, n: number): S[] => Array.from({ length: n }, () => ({ status: 'OWNED', gender }))

describe('inferGender', () => {
  it('constante acordada', () => assert.equal(GENDER_DOMINANCE_SHARE, 0.75))

  it('colección toda masculina → masculino; toda femenina → femenino', () => {
    assert.equal(inferGender(own('masculino', 6) as never), 'masculino')
    assert.equal(inferGender(own('femenino', 3) as never), 'femenino')
  })

  it('borde del umbral: 3 masculinos y 1 femenino (75 %) es masculino; 2 y 1 (67 %) es todos', () => {
    assert.equal(inferGender([...own('masculino', 3), ...own('femenino', 1)] as never), 'masculino')
    assert.equal(inferGender([...own('masculino', 2), ...own('femenino', 1)] as never), 'todos')
  })

  it('el unisex cuenta a favor de ambos géneros', () => {
    assert.equal(inferGender([...own('masculino', 2), ...own('unisex', 2)] as never), 'masculino')
    assert.equal(inferGender([...own('femenino', 1), ...own('unisex', 3)] as never), 'femenino')
  })

  it('todo unisex, sin datos o repartido → todos; con ambos por encima del umbral tampoco elige', () => {
    assert.equal(inferGender(own('unisex', 5) as never), 'todos')
    assert.equal(inferGender([] as never), 'todos')
    assert.equal(inferGender([{ status: 'OWNED' }, { status: 'OWNED', gender: null }] as never), 'todos')
    assert.equal(inferGender([...own('masculino', 1), ...own('femenino', 1), ...own('unisex', 8)] as never), 'todos')
  })

  it('solo cuentan OWNED y SAMPLED; deseados y descartados no', () => {
    const wishlist = Array.from({ length: 9 }, () => ({ status: 'WISHLIST', gender: 'femenino' }))
    const disliked = Array.from({ length: 9 }, () => ({ status: 'DISLIKED', gender: 'femenino' }))
    assert.equal(inferGender([...own('masculino', 4), { status: 'SAMPLED', gender: 'masculino' }, ...wishlist, ...disliked] as never), 'masculino')
  })

  it('ignora géneros desconocidos', () => {
    assert.equal(inferGender([...own('masculino', 3), ...own('raro', 50)] as never), 'masculino')
  })
})

describe('allowedGenders', () => {
  it('masculino y femenino incluyen unisex; unisex es solo unisex; todos no filtra', () => {
    assert.deepEqual(allowedGenders('masculino'), ['masculino', 'unisex'])
    assert.deepEqual(allowedGenders('femenino'), ['femenino', 'unisex'])
    assert.deepEqual(allowedGenders('unisex'), ['unisex'])
    assert.equal(allowedGenders('todos'), null)
  })

  it('hay 4 filtros', () => assert.deepEqual([...GENDER_FILTERS], ['masculino', 'unisex', 'femenino', 'todos']))
})

describe('parseGenderChoice', () => {
  it('sin elección es undefined; válida pasa; cualquier otra cosa es inválida', () => {
    assert.equal(parseGenderChoice({}), undefined)
    assert.equal(parseGenderChoice(null), undefined)
    assert.equal(parseGenderChoice({ gender: 'femenino' }), 'femenino')
    assert.equal(parseGenderChoice({ gender: 'todos' }), 'todos')
    for (const bad of [{ gender: 'otro' }, { gender: 5 }, { gender: null }, { gender: ['masculino'] }, 'masculino', [], 7]) {
      assert.equal(parseGenderChoice(bad), 'invalid', JSON.stringify(bad))
    }
  })
})

describe('resolveGender', () => {
  it('lo elegido manda sobre lo deducido', () => {
    assert.deepEqual(resolveGender('masculino', undefined), { applied: 'masculino', inferred: 'masculino', chosen: false })
    assert.deepEqual(resolveGender('masculino', 'todos'), { applied: 'todos', inferred: 'masculino', chosen: true })
  })
})
