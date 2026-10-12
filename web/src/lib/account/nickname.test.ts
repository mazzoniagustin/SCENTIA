import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { generateTemporaryNickname, isNicknameConflict, nicknameKey, validateNickname } from './nickname.ts'

describe('validateNickname', () => {
  it('acepta letras, números, guion y guion bajo, y devuelve la clave en minúsculas', () => {
    assert.deepEqual(validateNickname('Ana_Perfumes-9'), { ok: true, nickname: 'Ana_Perfumes-9', key: 'ana_perfumes-9' })
  })

  it('recorta espacios alrededor', () => {
    assert.deepEqual(validateNickname('  luna  '), { ok: true, nickname: 'luna', key: 'luna' })
  })

  it('respeta los límites de 3 y 20 caracteres', () => {
    assert.equal(validateNickname('abc').ok, true)
    assert.equal(validateNickname('a'.repeat(20)).ok, true)
    assert.equal(validateNickname('ab').ok, false)
    assert.equal(validateNickname('a'.repeat(21)).ok, false)
  })

  it('rechaza caracteres fuera del formato (espacios internos, acentos, ñ, símbolos, Unicode)', () => {
    for (const bad of ['con espacio', 'camión', 'niño', 'a@b', 'a.b', 'emoji😀x', 'аdmin1', 'a\nb', '<b>x</b>']) {
      assert.deepEqual(validateNickname(bad), { ok: false, error: 'invalid' }, bad)
    }
  })

  it('rechaza valores que no son texto (los metadatos pueden ser cualquier JSON)', () => {
    for (const bad of [undefined, null, 42, true, ['luna'], { nickname: 'luna' }]) {
      assert.deepEqual(validateNickname(bad), { ok: false, error: 'invalid' })
    }
  })

  it('rechaza los reservados sin distinguir mayúsculas', () => {
    for (const reserved of ['admin', 'ADMIN', 'Root', 'soporte', 'Support', 'scentia', 'SCENTIA', 'system', 'Moderador']) {
      assert.deepEqual(validateNickname(reserved), { ok: false, error: 'reserved' }, reserved)
    }
  })

  it('un reservado con texto extra sí se acepta', () => {
    assert.equal(validateNickname('admin2').ok, true)
    assert.equal(validateNickname('scentia_fan').ok, true)
  })
})

describe('nicknameKey', () => {
  it('dos apodos que difieren solo en mayúsculas comparten clave', () => {
    assert.equal(nicknameKey('LunA'), nicknameKey('lUNa'))
  })
})

describe('generateTemporaryNickname', () => {
  it('cumple el formato, pero el reservado de prefijo no aplica', () => {
    const nickname = generateTemporaryNickname()
    assert.match(nickname, /^perfumista-[a-z0-9]{6}$/)
    assert.equal(validateNickname(nickname).ok, true)
  })

  it('usa el generador inyectado', () => {
    assert.equal(generateTemporaryNickname(() => 0), 'perfumista-000000')
  })
})

describe('isNicknameConflict', () => {
  it('reconoce el índice por distintos caminos', () => {
    assert.equal(isNicknameConflict({ code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { index: 'UserProfile_nickname_lower_key' } } } } }), true)
    assert.equal(isNicknameConflict({ code: 'P2002', meta: { target: ['nickname'] } }), true)
    assert.equal(isNicknameConflict({ code: 'P2002', meta: {}, message: 'Unique constraint failed on UserProfile_nickname_lower_key' }), true)
  })

  it('no confunde otras violaciones únicas ni otros errores', () => {
    assert.equal(isNicknameConflict({ code: 'P2002', meta: { target: ['userId'] } }), false)
    assert.equal(isNicknameConflict({ code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { index: 'UserProfile_pkey' } } } } }), false)
    assert.equal(isNicknameConflict({ code: 'P2025' }), false)
    assert.equal(isNicknameConflict(null), false)
    assert.equal(isNicknameConflict(new Error('boom')), false)
  })
})
