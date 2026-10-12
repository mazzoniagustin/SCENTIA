import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { clientIp, limitAction, rateLimit, resetRateLimits } from './rate-limit.ts'

const opts = (now: number) => ({ limit: 3, windowMs: 60_000, now })

describe('rateLimit', () => {
  beforeEach(resetRateLimits)

  it('permite hasta el límite y luego bloquea con Retry-After', () => {
    assert.deepEqual(rateLimit('ip', opts(0)), { ok: true, remaining: 2 })
    assert.deepEqual(rateLimit('ip', opts(1000)), { ok: true, remaining: 1 })
    assert.deepEqual(rateLimit('ip', opts(2000)), { ok: true, remaining: 0 })
    assert.deepEqual(rateLimit('ip', opts(3000)), { ok: false, retryAfterSeconds: 57 })
  })

  it('la ventana se reinicia al vencer', () => {
    for (let i = 0; i < 3; i++) rateLimit('ip', opts(0))
    assert.equal(rateLimit('ip', opts(59_999)).ok, false)
    assert.deepEqual(rateLimit('ip', opts(60_000)), { ok: true, remaining: 2 })
  })

  it('cuenta por clave: una IP no afecta a otra', () => {
    for (let i = 0; i < 3; i++) rateLimit('a', opts(0))
    assert.equal(rateLimit('a', opts(0)).ok, false)
    assert.equal(rateLimit('b', opts(0)).ok, true)
  })
})

describe('clientIp', () => {
  it('toma el primer valor de x-forwarded-for, luego x-real-ip, y por último "unknown"', () => {
    assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4')
    assert.equal(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' })), '5.6.7.8')
    assert.equal(clientIp(new Headers()), 'unknown')
  })
})

describe('limitAction', () => {
  beforeEach(resetRateLimits)

  it('permite bajo el límite y bloquea al excederlo', () => {
    for (let i = 0; i < 3; i++) assert.equal(limitAction('saveNickname', 'u1', opts(0)).ok, true)
    const blocked = limitAction('saveNickname', 'u1', opts(1000))
    assert.deepEqual(blocked, { ok: false, retryAfterSeconds: 59 })
  })

  it('la ventana se reinicia', () => {
    for (let i = 0; i < 3; i++) limitAction('wear', 'u1', opts(0))
    assert.equal(limitAction('wear', 'u1', opts(59_999)).ok, false)
    assert.equal(limitAction('wear', 'u1', opts(60_000)).ok, true)
  })

  it('claves independientes por acción y por usuario', () => {
    for (let i = 0; i < 3; i++) limitAction('collection', 'u1', opts(0))
    assert.equal(limitAction('collection', 'u1', opts(0)).ok, false)
    assert.equal(limitAction('wear', 'u1', opts(0)).ok, true)
    assert.equal(limitAction('collection', 'u2', opts(0)).ok, true)
  })
})
