import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { MAX_PER_PERFUME, pickSimilar } from './similar.ts'

describe('pickSimilar', () => {
  it('descarta votos insuficientes, saldo no positivo, repetidos y el propio perfume', () => {
    const rows = pickSimilar('10', [
      { id: 1, up_votes: 2, down_votes: 0 }, // pocos votos
      { id: 2, up_votes: 5, down_votes: 5 }, // empate
      { id: 3, up_votes: 5, down_votes: 9 }, // más en contra
      { id: 10, up_votes: 99, down_votes: 0 }, // el mismo perfume
      { id: 4, up_votes: 8, down_votes: 2 },
      { id: 4, up_votes: 50, down_votes: 0 }, // repetido
    ])
    assert.deepEqual(rows, [{ similarSourceId: '4', upVotes: 8, downVotes: 2, net: 6 }])
  })

  it('ordena por saldo, luego por votos a favor', () => {
    const rows = pickSimilar('1', [
      { id: 7, up_votes: 10, down_votes: 5 },
      { id: 8, up_votes: 20, down_votes: 4 },
      { id: 9, up_votes: 6, down_votes: 1 },
    ])
    assert.deepEqual(rows.map((r) => r.similarSourceId), ['8', '7', '9'])
  })

  it('tolera basura y acota la cantidad', () => {
    assert.deepEqual(pickSimilar('1', null), [])
    assert.deepEqual(pickSimilar('1', [null, 5, 'x', { id: 'abc', up_votes: 9 }, { id: 2, up_votes: 'x' }]), [])
    const many = Array.from({ length: 40 }, (_, i) => ({ id: i + 100, up_votes: 10 + i, down_votes: 0 }))
    assert.equal(pickSimilar('1', many).length, MAX_PER_PERFUME)
  })

  it('acepta ids como texto numérico', () => {
    assert.equal(pickSimilar('1', [{ id: '55', up_votes: 4, down_votes: 0 }])[0].similarSourceId, '55')
  })
})
