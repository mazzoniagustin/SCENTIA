import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { filterBrands, groupByLetter, indexLetter } from './brand-index.ts'

const e = (brand: string, count = 1) => ({ brand, count })

describe('indexLetter', () => {
  it('quita acentos y manda lo que no es letra a #', () => {
    assert.equal(indexLetter('Armaf'), 'A')
    assert.equal(indexLetter('Émilio Pucci'), 'E')
    assert.equal(indexLetter('ñandú'), 'N')
    assert.equal(indexLetter('4711'), '#')
    assert.equal(indexLetter("'S Parfums"), '#')
  })
})

describe('groupByLetter', () => {
  it('ordena A-Z con # al final y los nombres dentro de cada letra', () => {
    const groups = groupByLetter([e('Zara'), e('4711'), e('Armaf'), e('Adidas'), e('Álvarez Gómez')])
    assert.deepEqual(groups.map((g) => g.letter), ['A', 'Z', '#'])
    assert.deepEqual(groups[0].brands.map((b) => b.brand), ['Adidas', 'Álvarez Gómez', 'Armaf'])
  })
})

describe('filterBrands', () => {
  const all = [e('Dior'), e('Émilio Pucci'), e('Armaf')]
  it('busca sin distinguir acentos ni mayúsculas', () => {
    assert.deepEqual(filterBrands(all, 'emilio').map((b) => b.brand), ['Émilio Pucci'])
    assert.deepEqual(filterBrands(all, ' DIO ').map((b) => b.brand), ['Dior'])
  })
  it('sin texto devuelve todo y sin coincidencias nada', () => {
    assert.equal(filterBrands(all, '').length, 3)
    assert.equal(filterBrands(all, 'zzz').length, 0)
  })
})
