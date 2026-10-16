import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { sendMagicLink, type MagicLinkDeps, type OtpError } from './magic-link.ts'

type Call = Parameters<MagicLinkDeps['signInWithOtp']>[0]

function makeDeps(overrides: Partial<MagicLinkDeps> & { otpError?: OtpError | null } = {}) {
  const calls: Call[] = []
  const deps: MagicLinkDeps = {
    signInWithOtp: async (args) => {
      calls.push(args)
      return { error: overrides.otpError ?? null }
    },
    origin: 'https://scentia.example',
    isNicknameTaken: async () => false,
    allowRequest: () => true,
    ...overrides,
  }
  return { deps, calls }
}

describe('sendMagicLink — registro', () => {
  it('crea usuarios (shouldCreateUser: true) y pasa el apodo en data', async () => {
    const { deps, calls } = makeDeps()
    const to = await sendMagicLink('signup', { email: ' Ana@Mail.com ', nickname: ' Ana_9 ' }, deps)
    assert.equal(to, '/registro?sent=1')
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      email: 'ana@mail.com',
      options: { shouldCreateUser: true, emailRedirectTo: 'https://scentia.example/auth/confirm', data: { nickname: 'Ana_9' } },
    })
  })

  it('apodo omitido (vacío, solo espacios o ausente) es válido y no manda data.nickname', async () => {
    for (const nickname of ['', '   ', undefined, null]) {
      const { deps, calls } = makeDeps()
      assert.equal(await sendMagicLink('signup', { email: 'a@b.co', nickname }, deps), '/registro?sent=1')
      assert.deepEqual(calls[0].options, { shouldCreateUser: true, emailRedirectTo: 'https://scentia.example/auth/confirm' })
    }
  })

  it('apodo inválido o reservado: no envía nada y devuelve el apodo, nunca el correo', async () => {
    const { deps, calls } = makeDeps()
    assert.equal(await sendMagicLink('signup', { email: 'a@b.co', nickname: 'x' }, deps), '/registro?error=nickname&nickname=x')
    assert.equal(
      await sendMagicLink('signup', { email: 'a@b.co', nickname: 'Admin' }, deps),
      '/registro?error=nickname-reserved&nickname=Admin',
    )
    assert.equal(calls.length, 0)
  })

  it('apodo tomado: avisa antes de enviar', async () => {
    const keys: string[] = []
    const { deps, calls } = makeDeps({ isNicknameTaken: async (key) => (keys.push(key), true) })
    const to = await sendMagicLink('signup', { email: 'a@b.co', nickname: 'Luna' }, deps)
    assert.equal(to, '/registro?error=nickname-taken&nickname=Luna')
    assert.deepEqual(keys, ['luna'])
    assert.equal(calls.length, 0)
  })

  it('correo inválido conserva el apodo pero nunca el correo en la URL', async () => {
    const { deps } = makeDeps()
    const to = await sendMagicLink('signup', { email: 'no-es-correo', nickname: 'luna' }, deps)
    assert.equal(to, '/registro?error=email&nickname=luna')
    assert.ok(!to.includes('no-es-correo'))
  })

  it('un error real de Supabase es "unavailable"', async () => {
    const { deps } = makeDeps({ otpError: { status: 429, code: 'over_email_send_rate_limit' } })
    assert.equal(await sendMagicLink('signup', { email: 'a@b.co', nickname: 'luna' }, deps), '/registro?error=unavailable&nickname=luna')
  })

  it('un apodo que no es texto se trata como inválido', async () => {
    const { deps, calls } = makeDeps()
    assert.equal(await sendMagicLink('signup', { email: 'a@b.co', nickname: { x: 1 } }, deps), '/registro?error=nickname')
    assert.equal(calls.length, 0)
  })
})

describe('sendMagicLink — login', () => {
  it('no crea usuarios (shouldCreateUser: false) y no manda data aunque llegue un apodo', async () => {
    const { deps, calls } = makeDeps()
    const to = await sendMagicLink('login', { email: 'ana@mail.com', nickname: 'intruso' }, deps)
    assert.equal(to, '/login?sent=1')
    assert.deepEqual(calls[0], {
      email: 'ana@mail.com',
      options: { shouldCreateUser: false, emailRedirectTo: 'https://scentia.example/auth/confirm' },
    })
  })

  it('un correo no registrado da la misma respuesta que uno registrado', async () => {
    const registered = makeDeps()
    const unknown = makeDeps({ otpError: { status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' } })
    const a = await sendMagicLink('login', { email: 'si@mail.com' }, registered.deps)
    const b = await sendMagicLink('login', { email: 'no@mail.com' }, unknown.deps)
    assert.equal(a, b)
  })

  it('reconoce el mensaje de Supabase aunque no traiga código', async () => {
    const { deps } = makeDeps({ otpError: { status: 422, message: 'Signups not allowed for this instance' } })
    assert.equal(await sendMagicLink('login', { email: 'no@mail.com' }, deps), '/login?sent=1')
  })

  it('los fallos reales siguen siendo "unavailable"', async () => {
    for (const otpError of [{ status: 429 }, { status: 500 }, { status: 0, message: 'fetch failed' }]) {
      const { deps } = makeDeps({ otpError })
      assert.equal(await sendMagicLink('login', { email: 'a@b.co' }, deps), '/login?error=unavailable')
    }
  })

  it('correo inválido', async () => {
    const { deps, calls } = makeDeps()
    assert.equal(await sendMagicLink('login', { email: 5 }, deps), '/login?error=email')
    assert.equal(calls.length, 0)
  })
})

describe('sendMagicLink — común', () => {
  it('sin origen no envía', async () => {
    const { deps, calls } = makeDeps({ origin: null })
    assert.equal(await sendMagicLink('login', { email: 'a@b.co' }, deps), '/login?error=request')
    assert.equal(calls.length, 0)
  })

  it('el límite de envíos corta antes de validar o enviar', async () => {
    const { deps, calls } = makeDeps({ allowRequest: () => false })
    assert.equal(await sendMagicLink('login', { email: 'a@b.co' }, deps), '/login?error=rate')
    assert.equal(await sendMagicLink('signup', { email: 'a@b.co', nickname: 'luna' }, deps), '/registro?error=rate&nickname=luna')
    assert.equal(calls.length, 0)
  })
})
