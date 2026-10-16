import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { PASSWORD_ERRORS, validatePassword, validatePasswordChange, validatePasswordPair } from './password.ts'

describe('validatePassword', () => {
  it('5 caracteres es corta y 6 es válida', () => {
    assert.deepEqual(validatePassword('12345'), { ok: false, error: 'short' })
    assert.deepEqual(validatePassword('123456'), { ok: true, password: '123456' })
  })

  it('72 caracteres es válida y 73 es larga', () => {
    assert.equal(validatePassword('a'.repeat(72)).ok, true)
    assert.deepEqual(validatePassword('a'.repeat(73)), { ok: false, error: 'long' })
  })

  it('vacía o que no es texto es "empty"', () => {
    for (const raw of ['', undefined, null, 42, {}]) assert.deepEqual(validatePassword(raw), { ok: false, error: 'empty' })
  })

  it('no recorta los espacios', () => {
    assert.deepEqual(validatePassword('  abcd  '), { ok: true, password: '  abcd  ' })
    assert.deepEqual(validatePassword('    '), { ok: false, error: 'short' })
  })
})

describe('validatePasswordPair', () => {
  it('iguales y válidas', () => {
    assert.deepEqual(validatePasswordPair('abcdef', 'abcdef'), { ok: true, password: 'abcdef' })
  })
  it('distintas es "mismatch"', () => {
    assert.deepEqual(validatePasswordPair('abcdef', 'abcdeg'), { ok: false, error: 'mismatch' })
  })
  it('una corta falla por el largo antes que por la comparación', () => {
    assert.deepEqual(validatePasswordPair('abc', 'abc'), { ok: false, error: 'short' })
  })
})

describe('validatePasswordChange', () => {
  it('cambio válido devuelve actual y nueva', () => {
    assert.deepEqual(validatePasswordChange('vieja123', 'nueva456', 'nueva456'), { ok: true, current: 'vieja123', password: 'nueva456' })
  })
  it('falta la actual', () => {
    assert.deepEqual(validatePasswordChange('', 'nueva456', 'nueva456'), { ok: false, error: 'current-empty' })
  })
  it('la nueva igual a la actual es "same"', () => {
    assert.deepEqual(validatePasswordChange('viejaaa', 'viejaaa', 'viejaaa'), { ok: false, error: 'same' })
  })
  it('la nueva corta o que no coincide falla', () => {
    assert.deepEqual(validatePasswordChange('vieja123', 'abc', 'abc'), { ok: false, error: 'short' })
    assert.deepEqual(validatePasswordChange('vieja123', 'nueva456', 'nueva457'), { ok: false, error: 'mismatch' })
  })
})

describe('PASSWORD_ERRORS', () => {
  it('tiene mensaje para cada clave de error de la interfaz', () => {
    for (const key of ['password-empty', 'password-short', 'password-long', 'password-mismatch', 'password-same', 'password-current', 'password-wrong']) {
      assert.ok(PASSWORD_ERRORS[key], key)
    }
  })
})
