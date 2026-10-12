import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { creationStatus } from './creation-status.ts'

describe('creationStatus', () => {
  it('con --as-draft fija DRAFT', () => {
    assert.deepEqual(creationStatus(true), { status: 'DRAFT' })
  })

  it('sin --as-draft no agrega la clave status (rige el default del schema)', () => {
    const row = { brand: 'X', ...creationStatus(false) }
    assert.deepEqual(row, { brand: 'X' })
    assert.equal('status' in row, false)
  })
})
