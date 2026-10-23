import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { perfumeCountLabel } from './count-label.ts'

describe('perfumeCountLabel', () => {
  it('cero es «Sin perfumes»', () => assert.equal(perfumeCountLabel(0), 'Sin perfumes'))
  it('uno va en singular', () => assert.equal(perfumeCountLabel(1), '1 perfume'))
  it('varios van en plural', () => assert.equal(perfumeCountLabel(12), '12 perfumes'))
  it('un valor negativo se trata como vacío', () => assert.equal(perfumeCountLabel(-3), 'Sin perfumes'))
})
