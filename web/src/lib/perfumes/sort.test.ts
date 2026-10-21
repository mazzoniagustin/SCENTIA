import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseSort, SORT_ORDER, SORT_VALUES } from './sort.ts'

describe('parseSort', () => {
  it('sin valor ordena por relevancia', () => {
    assert.equal(parseSort(null), 'relevance')
    assert.equal(parseSort(''), 'relevance')
  })

  it('acepta cada valor conocido y rechaza el resto', () => {
    for (const value of SORT_VALUES) assert.equal(parseSort(value), value)
    assert.equal(parseSort('popularidad'), null)
  })
})

describe('SORT_ORDER.relevance', () => {
  it('ordena por votos de mayor a menor, con los perfumes sin dato al final', () => {
    assert.deepEqual(SORT_ORDER.relevance[0], { ratingCount: { sort: 'desc', nulls: 'last' } })
  })

  it('desempata de forma determinista por marca y nombre', () => {
    assert.deepEqual(SORT_ORDER.relevance.slice(1), [{ brand: 'asc' }, { name: 'asc' }])
  })

  it('todos los órdenes tienen un desempate, para que la paginación sea estable', () => {
    for (const value of SORT_VALUES) assert.ok(SORT_ORDER[value].length >= 2, value)
  })
})
