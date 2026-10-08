import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isValidPerfumeId, MAX_NOTES_LENGTH, validateCollectionEntry } from './validation.ts'

const base = { perfumeId: 'p1', status: 'OWNED' }

describe('validateCollectionEntry', () => {
  it('acepta una entrada mínima y una completa', () => {
    assert.deepEqual(validateCollectionEntry(base), {
      ok: true, value: { perfumeId: 'p1', status: 'OWNED', rating: undefined, personalNotes: undefined },
    })
    const full = validateCollectionEntry({ ...base, status: 'WISHLIST', rating: 5, personalNotes: 'me encanta' })
    assert.ok(full.ok && full.value.rating === 5 && full.value.personalNotes === 'me encanta')
  })

  it('rechaza estados que no existen (los tipos no se validan en ejecución)', () => {
    for (const status of ['owned', 'ADMIN', '', 3, null, undefined]) {
      assert.equal(validateCollectionEntry({ ...base, status }).ok, false, String(status))
    }
  })

  it('rating: solo enteros de 1 a 5', () => {
    for (const rating of [0, 6, 2.5, NaN, Infinity, '3', -1]) {
      assert.equal(validateCollectionEntry({ ...base, rating }).ok, false, String(rating))
    }
    for (const rating of [1, 2, 3, 4, 5]) assert.equal(validateCollectionEntry({ ...base, rating }).ok, true)
  })

  it('notas: tope de longitud y solo texto', () => {
    assert.equal(validateCollectionEntry({ ...base, personalNotes: 'x'.repeat(MAX_NOTES_LENGTH) }).ok, true)
    assert.equal(validateCollectionEntry({ ...base, personalNotes: 'x'.repeat(MAX_NOTES_LENGTH + 1) }).ok, false)
    assert.equal(validateCollectionEntry({ ...base, personalNotes: { a: 1 } }).ok, false)
  })

  it('perfumeId: texto no vacío y acotado; entradas que no son objeto', () => {
    for (const perfumeId of ['', 'x'.repeat(65), 5, null, undefined, {}]) {
      assert.equal(validateCollectionEntry({ ...base, perfumeId }).ok, false, String(perfumeId))
    }
    for (const bad of [null, 'x', [], 5]) assert.equal(validateCollectionEntry(bad).ok, false)
    assert.equal(isValidPerfumeId('cmuyubbpy009k9rw5msp2ncmt'), true)
  })

  it('ignora campos extra: no se cuelan al resultado', () => {
    const result = validateCollectionEntry({ ...base, userId: 'otra-persona', admin: true })
    assert.ok(result.ok)
    assert.deepEqual(Object.keys(result.value).sort(), ['perfumeId', 'personalNotes', 'rating', 'status'])
  })
})
