import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { collectionInputFromFormData } from './form.ts'
import { validateCollectionEntry } from './validation.ts'

const form = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('collectionInputFromFormData', () => {
  it('un formulario completo pasa la validación', () => {
    const input = collectionInputFromFormData(form({ perfumeId: 'p1', status: 'OWNED', rating: '4', personalNotes: 'me encanta' }))
    assert.deepEqual(input, { perfumeId: 'p1', status: 'OWNED', rating: 4, personalNotes: 'me encanta' })
    assert.equal(validateCollectionEntry(input).ok, true)
  })
  it('puntuación y notas vacías quedan sin definir', () => {
    const input = collectionInputFromFormData(form({ perfumeId: 'p1', status: 'SAMPLED', rating: '', personalNotes: '   ' }))
    assert.equal(input.rating, undefined)
    assert.equal(input.personalNotes, undefined)
    assert.equal(validateCollectionEntry(input).ok, true)
  })
  it('sin estado elegido la validación lo rechaza', () => {
    const input = collectionInputFromFormData(form({ perfumeId: 'p1', status: '' }))
    assert.equal(validateCollectionEntry(input).ok, false)
  })
  it('puntuación fuera de rango o no numérica se rechaza', () => {
    for (const rating of ['0', '6', '2.5', 'abc']) {
      assert.equal(validateCollectionEntry(collectionInputFromFormData(form({ perfumeId: 'p1', status: 'OWNED', rating }))).ok, false, rating)
    }
  })
  it('ignora campos que no son texto (archivos) y los desconocidos', () => {
    const f = form({ perfumeId: 'p1', status: 'OWNED', extra: 'x' })
    f.set('personalNotes', new Blob(['x']), 'a.txt')
    const input = collectionInputFromFormData(f)
    assert.equal(input.personalNotes, undefined)
    assert.equal('extra' in input, false)
  })
})
