import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { generateShareToken, hashShareToken, isValidShareToken } from './token.ts'

describe('token de link', () => {
  it('generateShareToken devuelve un token de 43 caracteres base64url y un hash hex de 64', () => {
    const { token, tokenHash } = generateShareToken()
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    assert.match(tokenHash, /^[0-9a-f]{64}$/)
  })

  it('dos llamadas devuelven tokens distintos', () => {
    const a = generateShareToken()
    const b = generateShareToken()
    assert.notEqual(a.token, b.token)
  })

  it('hashShareToken es determinista y coincide con el tokenHash generado', () => {
    const { token, tokenHash } = generateShareToken()
    assert.equal(hashShareToken(token), tokenHash)
    assert.equal(hashShareToken(token), hashShareToken(token))
  })

  it('isValidShareToken acepta un token generado y rechaza formatos inválidos', () => {
    const { token } = generateShareToken()
    assert.equal(isValidShareToken(token), true)
    assert.equal(isValidShareToken(''), false)
    assert.equal(isValidShareToken('a'.repeat(42)), false)
    assert.equal(isValidShareToken('a'.repeat(44)), false)
    assert.equal(isValidShareToken('a'.repeat(42) + '%'), false)
    assert.equal(isValidShareToken('a'.repeat(5000)), false)
    assert.equal(isValidShareToken(null), false)
    assert.equal(isValidShareToken(123), false)
  })
})
