import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateSimilarityScore,
  NOTE_TYPE_WEIGHTS,
  W_NOTES,
  type PerfumeWithRelations,
  type UserCollectionEntry,
} from './similarity.ts'

// Comparación tolerante a errores de punto flotante: 0.6·0.4 no es exacto en
// binario, así que la igualdad estricta fallaría por un ULP. Se usa un margen.
function assertClose(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `se esperaba ${expected} (±${epsilon}), se obtuvo ${actual}`,
  )
}

// Fixtures canónicos del solapamiento parcial (score 0.54): mismo acorde con
// distinta intensidad (min(4,9)) y una nota base compartida.
const base: PerfumeWithRelations = {
  id: 'p1',
  accords: [
    { accordId: 'a1', intensity: 4 },
    { accordId: 'a2', intensity: 6 },
  ],
  notes: [
    { noteId: 'n1', noteType: 'base' },
    { noteId: 'n2', noteType: 'top' },
  ],
}

const candidate: PerfumeWithRelations = {
  id: 'p2',
  accords: [{ accordId: 'a1', intensity: 9 }],
  notes: [{ noteId: 'n1', noteType: 'base' }],
}

describe('calculateSimilarityScore', () => {
  it('acordes con distinta intensidad + notas por fase → 0.54 (regresión de pesos)', () => {
    // accordScore = min(4,9)/(4+6) = 0.4; noteScore = 3/(3+1) = 0.75
    // score = 0.6·0.4 + 0.4·0.75 = 0.54. El min evita que la intensidad 9
    // del candidato infle el acorde compartido.
    assertClose(calculateSimilarityScore(base, candidate), 0.54)
  })

  it('idénticos → 1.0 (normalización al máximo)', () => {
    assertClose(calculateSimilarityScore(base, base), 1.0)
  })

  it('sin intersección → 0', () => {
    const stranger: PerfumeWithRelations = {
      id: 'p3',
      accords: [{ accordId: 'a9', intensity: 5 }],
      notes: [{ noteId: 'n9', noteType: 'base' }],
    }
    assert.equal(calculateSimilarityScore(base, stranger), 0)
  })

  it('relaciones ausentes o base vacía → 0, sin excepción ni NaN', () => {
    const lazyLoaded: PerfumeWithRelations = { id: 'p2' }
    assert.equal(calculateSimilarityScore(base, lazyLoaded), 0)

    const emptyRef: PerfumeWithRelations = { id: 'p0', accords: [], notes: [] }
    assert.equal(calculateSimilarityScore(emptyRef, candidate), 0)
  })

  it('pesos por fase: base=3, heart=2, top=1 (solo notas)', () => {
    const ref: PerfumeWithRelations = {
      id: 'pn',
      accords: [],
      notes: [
        { noteId: 'nb', noteType: 'base' },
        { noteId: 'nh', noteType: 'heart' },
        { noteId: 'nt', noteType: 'top' },
      ],
    }
    const cand: PerfumeWithRelations = {
      id: 'pc',
      accords: [],
      notes: [
        { noteId: 'nb', noteType: 'base' },
        { noteId: 'nh', noteType: 'heart' },
      ],
    }
    // total = 3+2+1 = 6; shared = 3+2 = 5; noteScore = 5/6; score = 0.4·5/6
    assertClose(calculateSimilarityScore(ref, cand), (W_NOTES * 5) / 6)

    // El contrato de pesos queda fijado: si alguien cambia 3/2/1, esto falla.
    assert.equal(NOTE_TYPE_WEIGHTS.base, 3)
    assert.equal(NOTE_TYPE_WEIGHTS.heart, 2)
    assert.equal(NOTE_TYPE_WEIGHTS.top, 1)
  })
})

describe('exclusiones por colección', () => {
  it('owned y disliked excluyen (→ 0); wishlist y sampled no', () => {
    const owned: UserCollectionEntry[] = [{ perfumeId: 'p2', status: 'owned' }]
    assert.equal(calculateSimilarityScore(base, candidate, owned), 0)

    const disliked: UserCollectionEntry[] = [{ perfumeId: 'p2', status: 'disliked' }]
    assert.equal(calculateSimilarityScore(base, candidate, disliked), 0)

    const wishlist: UserCollectionEntry[] = [{ perfumeId: 'p2', status: 'wishlist' }]
    assertClose(calculateSimilarityScore(base, candidate, wishlist), 0.54)

    const sampled: UserCollectionEntry[] = [{ perfumeId: 'p2', status: 'sampled' }]
    assertClose(calculateSimilarityScore(base, candidate, sampled), 0.54)
  })

  it('acepta los estados en mayúscula del enum de Prisma (OWNED, DISLIKED)', () => {
    for (const status of ['OWNED', 'DISLIKED']) {
      assert.equal(calculateSimilarityScore(base, candidate, [{ perfumeId: 'p2', status }]), 0)
    }
    for (const status of ['WISHLIST', 'SAMPLED']) {
      assertClose(calculateSimilarityScore(base, candidate, [{ perfumeId: 'p2', status }]), 0.54)
    }
  })

  it('solo excluye al perfume señalado, no a otros de la colección', () => {
    const other: UserCollectionEntry[] = [{ perfumeId: 'other', status: 'owned' }]
    assertClose(calculateSimilarityScore(base, candidate, other), 0.54)
  })
})