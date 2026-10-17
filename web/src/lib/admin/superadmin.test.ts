import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isSuperadmin, parseSuperadminEmails } from './superadmin.ts'

const env = { SUPERADMIN_EMAILS: ' Yo@Example.com , otra@example.com,,no-es-correo, yo@example.com ' }

describe('parseSuperadminEmails', () => {
  it('normaliza, descarta lo inválido y no repite', () => {
    assert.deepEqual(parseSuperadminEmails(env.SUPERADMIN_EMAILS), ['yo@example.com', 'otra@example.com'])
  })
  it('sin variable o vacía no hay superadmins', () => {
    assert.deepEqual(parseSuperadminEmails(undefined), [])
    assert.deepEqual(parseSuperadminEmails(''), [])
    assert.deepEqual(parseSuperadminEmails(' , ,'), [])
  })
})

describe('isSuperadmin', () => {
  it('acepta un correo de la lista, confirmado, sin distinguir mayúsculas', () => {
    assert.equal(isSuperadmin({ email: 'YO@example.COM', emailConfirmed: true }, env), true)
  })
  it('rechaza sin sesión, sin correo o sin confirmar', () => {
    assert.equal(isSuperadmin(null, env), false)
    assert.equal(isSuperadmin(undefined, env), false)
    assert.equal(isSuperadmin({ email: null, emailConfirmed: true }, env), false)
    assert.equal(isSuperadmin({ email: 'yo@example.com', emailConfirmed: false }, env), false)
    assert.equal(isSuperadmin({ email: 'yo@example.com' }, env), false)
  })
  it('rechaza a quien no está en la lista, aunque el correo se parezca', () => {
    assert.equal(isSuperadmin({ email: 'ayo@example.com', emailConfirmed: true }, env), false)
    assert.equal(isSuperadmin({ email: 'yo@example.com.ar', emailConfirmed: true }, env), false)
    assert.equal(isSuperadmin({ email: 'yo@example.com,otra@example.com', emailConfirmed: true }, env), false)
  })
  it('cierra por defecto: sin la variable nadie entra', () => {
    assert.equal(isSuperadmin({ email: 'yo@example.com', emailConfirmed: true }, {}), false)
  })
})
