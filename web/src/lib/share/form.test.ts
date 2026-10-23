import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { shareInputFromFormData } from './form.ts'

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

describe('shareInputFromFormData', () => {
  it('scope ausente o inválido devuelve null', () => {
    assert.equal(shareInputFromFormData(fd({})), null)
    assert.equal(shareInputFromFormData(fd({ scope: 'OTRO' })), null)
  })

  it('showRatings on es true y ausente es false', () => {
    assert.deepEqual(shareInputFromFormData(fd({ scope: 'OWNED', showRatings: 'on' })), { scope: 'OWNED', showRatings: true })
    assert.deepEqual(shareInputFromFormData(fd({ scope: 'OWNED' })), { scope: 'OWNED', showRatings: false })
  })

  it('WISHLIST fuerza showRatings false', () => {
    assert.deepEqual(shareInputFromFormData(fd({ scope: 'WISHLIST', showRatings: 'on' })), { scope: 'WISHLIST', showRatings: false })
  })
})
