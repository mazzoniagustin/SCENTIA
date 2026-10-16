import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildDeletionSummary, DELETION_POLICY_VERSION, type DeletionInput } from './deletion-summary.ts'

const base: DeletionInput = {
  createdAt: new Date('2026-03-15T12:00:00Z'),
  deletedAt: new Date('2026-10-16T12:00:00Z'),
  hasQuizProfile: false,
  collection: [],
  wearDays: [],
}

const SUMMARY_KEYS = [
  'collection',
  'collectionTotal',
  'deletedMonth',
  'dislikedCount',
  'hadQuizProfile',
  'longestStreak',
  'ownedCount',
  'policyVersion',
  'ratingsCount',
  'ratingsSum',
  'sampledCount',
  'signedUpMonth',
  'wearDaysTotal',
  'wishlistCount',
]

describe('buildDeletionSummary', () => {
  it('colección vacía y sin racha: todo en cero, sin NaN', () => {
    const s = buildDeletionSummary(base)
    assert.equal(s.collectionTotal, 0)
    assert.equal(s.ownedCount + s.sampledCount + s.wishlistCount + s.dislikedCount, 0)
    assert.equal(s.ratingsCount, 0)
    assert.equal(s.ratingsSum, 0)
    assert.equal(s.longestStreak, 0)
    assert.equal(s.wearDaysTotal, 0)
    assert.deepEqual(s.collection, [])
  })

  it('cuenta la colección por estado', () => {
    const s = buildDeletionSummary({
      ...base,
      collection: [
        { perfumeId: 'a', status: 'OWNED', rating: null },
        { perfumeId: 'b', status: 'OWNED', rating: null },
        { perfumeId: 'c', status: 'SAMPLED', rating: null },
        { perfumeId: 'd', status: 'WISHLIST', rating: null },
        { perfumeId: 'e', status: 'DISLIKED', rating: null },
      ],
    })
    assert.equal(s.collectionTotal, 5)
    assert.equal(s.ownedCount, 2)
    assert.equal(s.sampledCount, 1)
    assert.equal(s.wishlistCount, 1)
    assert.equal(s.dislikedCount, 1)
    assert.equal(s.collection.length, 5)
  })

  it('un rating nulo no cuenta como valoración ni suma', () => {
    const s = buildDeletionSummary({
      ...base,
      collection: [
        { perfumeId: 'a', status: 'OWNED', rating: 4 },
        { perfumeId: 'b', status: 'OWNED', rating: 5 },
        { perfumeId: 'c', status: 'OWNED', rating: null },
      ],
    })
    assert.equal(s.ratingsCount, 2)
    assert.equal(s.ratingsSum, 9)
  })

  it('racha más larga y total de días registrados', () => {
    const s = buildDeletionSummary({ ...base, wearDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10'] })
    assert.equal(s.longestStreak, 3)
    assert.equal(s.wearDaysTotal, 4)
  })

  it('las fechas se reducen a mes (YYYY-MM)', () => {
    const s = buildDeletionSummary(base)
    assert.equal(s.signedUpMonth, '2026-03')
    assert.equal(s.deletedMonth, '2026-10')
  })

  it('solo expone la lista cerrada de campos, aunque la entrada traiga datos personales', () => {
    const dirty = {
      ...base,
      email: 'persona@example.test',
      name: 'Persona',
      nickname: 'persona',
      supabaseId: 'sb-1',
      personalNotes: 'secreto',
      collection: [{ perfumeId: 'a', status: 'OWNED' as const, rating: 3, personalNotes: 'secreto' }],
    }
    const s = buildDeletionSummary(dirty)
    assert.deepEqual(Object.keys(s).sort(), SUMMARY_KEYS)
    assert.deepEqual(Object.keys(s.collection[0]).sort(), ['perfumeId', 'rating', 'status'])
    assert.ok(!JSON.stringify(s).includes('secreto'))
    assert.ok(!JSON.stringify(s).includes('persona'))
  })

  it('marca si había perfil del quiz y la versión de la política', () => {
    const s = buildDeletionSummary({ ...base, hasQuizProfile: true })
    assert.equal(s.hadQuizProfile, true)
    assert.equal(s.policyVersion, DELETION_POLICY_VERSION)
  })
})
