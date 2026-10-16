import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { canChoosePassword, getPasswordSet, hasRecentLinkLogin, needsPasswordSetup } from './password-gate.ts'

const base = { method: 'GET', hasSession: true, passwordSet: false, pathname: '/perfumes' }

describe('needsPasswordSetup', () => {
  it('con sesión y sin marca, una página pide elegir contraseña', () => {
    assert.equal(needsPasswordSetup(base), true)
    assert.equal(needsPasswordSetup({ ...base, method: 'HEAD', pathname: '/' }), true)
  })
  it('con la marca o sin sesión no hace nada', () => {
    assert.equal(needsPasswordSetup({ ...base, passwordSet: true }), false)
    assert.equal(needsPasswordSetup({ ...base, hasSession: false }), false)
  })
  it('no toca los POST (Server Actions, como cerrar sesión)', () => {
    assert.equal(needsPasswordSetup({ ...base, method: 'POST', pathname: '/elegir-contrasena' }), false)
    assert.equal(needsPasswordSetup({ ...base, method: 'POST', pathname: '/account' }), false)
  })
  it('excluye la pantalla de elegir contraseña, /auth, /api y los recursos de Next', () => {
    for (const pathname of ['/elegir-contrasena', '/auth/confirm', '/api/health', '/api/account/export', '/_next/static/x.js']) {
      assert.equal(needsPasswordSetup({ ...base, pathname }), false, pathname)
    }
  })
  it('no confunde rutas parecidas con las excluidas', () => {
    assert.equal(needsPasswordSetup({ ...base, pathname: '/elegir-contrasena-x' }), true)
    assert.equal(needsPasswordSetup({ ...base, pathname: '/authors' }), true)
    assert.equal(needsPasswordSetup({ ...base, pathname: '/apix' }), true)
  })
})

describe('getPasswordSet', () => {
  it('solo es true con password_set === true', () => {
    assert.equal(getPasswordSet({ user_metadata: { password_set: true } }), true)
    for (const claims of [{ user_metadata: { password_set: 'true' } }, { user_metadata: { password_set: false } }, { user_metadata: {} }, {}, null, undefined, 'x']) {
      assert.equal(getPasswordSet(claims), false)
    }
  })
})

const NOW = 1_800_000_000

describe('hasRecentLinkLogin / canChoosePassword', () => {
  it('un ingreso por enlace de hace menos de 15 minutos cuenta', () => {
    for (const method of ['otp', 'magiclink', 'recovery']) {
      assert.equal(hasRecentLinkLogin({ amr: [{ method, timestamp: NOW - 60 }] }, NOW), true, method)
    }
  })
  it('uno viejo (más de 15 minutos), uno por contraseña o sin amr no cuentan', () => {
    assert.equal(hasRecentLinkLogin({ amr: [{ method: 'otp', timestamp: NOW - 901 }] }, NOW), false)
    assert.equal(hasRecentLinkLogin({ amr: [{ method: 'password', timestamp: NOW - 5 }] }, NOW), false)
    for (const claims of [{}, { amr: 'otp' }, { amr: [null, { method: 'otp' }] }, null, undefined]) {
      assert.equal(hasRecentLinkLogin(claims, NOW), false)
    }
  })
  it('con la sesión por contraseña y la marca puesta no se puede elegir sin la actual', () => {
    const claims = { amr: [{ method: 'password', timestamp: NOW - 5 }], user_metadata: { password_set: true } }
    assert.equal(canChoosePassword(claims, NOW), false)
  })
  it('sin marca siempre se puede; con marca solo tras un enlace reciente (recuperación)', () => {
    assert.equal(canChoosePassword({ user_metadata: {} }, NOW), true)
    assert.equal(canChoosePassword({ user_metadata: { password_set: true }, amr: [{ method: 'otp', timestamp: NOW - 30 }] }, NOW), true)
  })
})
