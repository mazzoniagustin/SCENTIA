import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseShareScope, SHARE_OWNER_FALLBACK, shareOwnerLabel, toPublicEntries, type SharedRow } from './view.ts'

const rowWithRating: SharedRow = {
  rating: 4,
  perfume: { id: 'p1', brand: 'Dior', name: 'Sauvage', gender: 'MALE', imageUrl: 'https://x/y.png' },
}

const rowWithoutRating: SharedRow = {
  rating: null,
  perfume: { id: 'p2', brand: 'Chanel', name: 'No5', gender: 'FEMALE', imageUrl: null },
}

const PUBLIC_KEYS = ['id', 'brand', 'name', 'gender', 'imageUrl', 'rating']

describe('vista pública de la colección compartida', () => {
  it('parseShareScope acepta OWNED y WISHLIST y rechaza el resto', () => {
    assert.equal(parseShareScope('OWNED'), 'OWNED')
    assert.equal(parseShareScope('WISHLIST'), 'WISHLIST')
    assert.equal(parseShareScope('owned'), null)
    assert.equal(parseShareScope('SAMPLED'), null)
    assert.equal(parseShareScope(''), null)
    assert.equal(parseShareScope(undefined), null)
  })

  it('con scope OWNED y showRatings incluye rating solo donde existe', () => {
    const entries = toPublicEntries([rowWithRating, rowWithoutRating], { scope: 'OWNED', showRatings: true })
    assert.equal(entries.length, 2)
    assert.equal(entries[0].rating, 4)
    assert.equal(Object.hasOwn(entries[0], 'rating'), true)
    assert.equal(Object.hasOwn(entries[1], 'rating'), false)
  })

  it('con showRatings false ninguna entrada tiene la clave rating', () => {
    const entries = toPublicEntries([rowWithRating, rowWithoutRating], { scope: 'OWNED', showRatings: false })
    for (const entry of entries) {
      assert.equal(Object.hasOwn(entry, 'rating'), false)
    }
  })

  it('con scope WISHLIST ninguna entrada tiene rating aunque showRatings sea true', () => {
    const entries = toPublicEntries([rowWithRating, rowWithoutRating], { scope: 'WISHLIST', showRatings: true })
    assert.equal(entries.length, 2)
    for (const entry of entries) {
      assert.equal(Object.hasOwn(entry, 'rating'), false)
    }
  })

  it('las entradas no contienen claves fuera de la lista pública, aunque la fila traiga campos extra', () => {
    const leaky = {
      ...rowWithRating,
      personalNotes: 'nota privada',
      email: 'ana@example.com',
    } as SharedRow
    const entries = toPublicEntries([leaky], { scope: 'OWNED', showRatings: true })
    assert.equal(entries.length, 1)
    for (const key of Object.keys(entries[0])) {
      assert.ok(PUBLIC_KEYS.includes(key), `clave no permitida: ${key}`)
    }
    assert.equal(JSON.stringify(entries[0]).includes('nota privada'), false)
    assert.equal(JSON.stringify(entries[0]).includes('ana@example.com'), false)
  })

  it('shareOwnerLabel usa el apodo o "Una colección" cuando no hay apodo útil', () => {
    assert.equal(shareOwnerLabel('ana_perfumes'), 'ana_perfumes')
    assert.equal(shareOwnerLabel(null), 'Una colección')
    assert.equal(shareOwnerLabel(undefined), 'Una colección')
    assert.equal(shareOwnerLabel('  '), 'Una colección')
    assert.equal(shareOwnerLabel(null), SHARE_OWNER_FALLBACK)
    assert.equal(shareOwnerLabel('ana_perfumes') === SHARE_OWNER_FALLBACK, false)
  })
})
