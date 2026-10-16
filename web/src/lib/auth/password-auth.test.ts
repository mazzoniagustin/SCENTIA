import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  changePassword,
  choosePassword,
  signInWithPasswordCore,
  signUpWithPassword,
  type AuthApiError,
  type ChangePasswordDeps,
  type ChoosePasswordDeps,
  type PasswordAuthDeps,
} from './password-auth.ts'

type Result = { error: AuthApiError | null }

function makeChoose(overrides: Partial<ChoosePasswordDeps> = {}) {
  const calls: string[] = []
  const updates: { password: string; data: { password_set: true } }[] = []
  const deps: ChoosePasswordDeps = {
    allowAction: () => true,
    canChoose: () => true,
    updateUser: async (args) => {
      calls.push('updateUser')
      updates.push(args)
      return { error: null } as Result
    },
    refreshSession: async () => {
      calls.push('refreshSession')
      return { error: null } as Result
    },
    ...overrides,
  }
  return { deps, calls, updates }
}

describe('choosePassword', () => {
  it('guarda la contraseña con la marca, refresca la sesión y vuelve a /account', async () => {
    const { deps, calls, updates } = makeChoose()
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/account')
    assert.deepEqual(updates, [{ password: 'abcdef', data: { password_set: true } }])
    assert.deepEqual(calls, ['updateUser', 'refreshSession'])
  })

  it('contraseñas distintas, cortas, largas o vacías: error y no llama a nada', async () => {
    const { deps, calls } = makeChoose()
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdeg' }, deps), '/elegir-contrasena?error=password-mismatch')
    assert.equal(await choosePassword({ password: 'abcde', repeat: 'abcde' }, deps), '/elegir-contrasena?error=password-short')
    assert.equal(await choosePassword({ password: 'a'.repeat(73), repeat: 'a'.repeat(73) }, deps), '/elegir-contrasena?error=password-long')
    assert.equal(await choosePassword({ password: '', repeat: '' }, deps), '/elegir-contrasena?error=password-empty')
    assert.deepEqual(calls, [])
  })

  it('límite excedido: no llama a nada', async () => {
    const { deps, calls } = makeChoose({ allowAction: () => false })
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/elegir-contrasena?error=rate')
    assert.deepEqual(calls, [])
  })

  it('si falla updateUser no refresca y no devuelve éxito', async () => {
    const { deps, calls } = makeChoose({
      updateUser: async () => {
        return { error: { message: 'x' } }
      },
    })
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/elegir-contrasena?error=unavailable')
    assert.deepEqual(calls, [])
  })

  it('si falla refreshSession tampoco devuelve éxito (evita el bucle con el token viejo)', async () => {
    const { deps } = makeChoose({ refreshSession: async () => ({ error: { message: 'x' } }) })
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/elegir-contrasena?error=unavailable')
  })

  it('si updateUser lanza, queda "unavailable" sin propagar', async () => {
    const { deps } = makeChoose({
      updateUser: async () => {
        throw new Error('red')
      },
    })
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/elegir-contrasena?error=unavailable')
  })
})

type SignUpArgs = Parameters<PasswordAuthDeps['signUp']>[0]

function makeAuth(overrides: Partial<PasswordAuthDeps> = {}) {
  const signUps: SignUpArgs[] = []
  const signIns: { email: string; password: string }[] = []
  const deps: PasswordAuthDeps = {
    origin: 'https://scentia.example',
    allowRequest: () => true,
    isNicknameTaken: async () => false,
    signUp: async (args) => {
      signUps.push(args)
      return { error: null }
    },
    signInWithPassword: async (args) => {
      signIns.push(args)
      return { error: null }
    },
    ...overrides,
  }
  return { deps, signUps, signIns }
}

describe('signUpWithPassword', () => {
  it('crea la cuenta con correo normalizado, redirección a /auth/confirm y la marca password_set', async () => {
    const { deps, signUps } = makeAuth()
    assert.equal(await signUpWithPassword({ email: ' Ana@Mail.com ', password: 'abcdef', nickname: ' Ana_9 ' }, deps), '/registro?sent=1')
    assert.deepEqual(signUps, [
      {
        email: 'ana@mail.com',
        password: 'abcdef',
        options: { emailRedirectTo: 'https://scentia.example/auth/confirm', data: { password_set: true, nickname: 'Ana_9' } },
      },
    ])
  })

  it('sin apodo no manda nickname', async () => {
    for (const nickname of ['', undefined]) {
      const { deps, signUps } = makeAuth()
      assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef', nickname }, deps), '/registro?sent=1')
      assert.deepEqual(signUps[0].options.data, { password_set: true })
    }
  })

  it('apodo inválido, reservado o tomado: su error, devuelve el apodo (nunca correo ni contraseña) y no crea nada', async () => {
    const { deps, signUps } = makeAuth({ isNicknameTaken: async (key) => key === 'luna' })
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef', nickname: 'x' }, deps), '/registro?error=nickname&nickname=x')
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef', nickname: 'Admin' }, deps), '/registro?error=nickname-reserved&nickname=Admin')
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef', nickname: 'Luna' }, deps), '/registro?error=nickname-taken&nickname=Luna')
    assert.deepEqual(signUps, [])
  })

  it('contraseña corta, larga o vacía; correo inválido; límite; sin origen', async () => {
    const { deps, signUps } = makeAuth()
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcde' }, deps), '/registro?error=password-short')
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'a'.repeat(73) }, deps), '/registro?error=password-long')
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: '' }, deps), '/registro?error=password-empty')
    assert.equal(await signUpWithPassword({ email: 'no-es-correo', password: 'abcdef' }, deps), '/registro?error=email')
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef' }, { ...deps, allowRequest: () => false }), '/registro?error=rate')
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef' }, { ...deps, origin: null }), '/registro?error=request')
    assert.deepEqual(signUps, [])
  })

  it('la ruta de error nunca contiene el correo ni la contraseña', async () => {
    const { deps } = makeAuth()
    const to = await signUpWithPassword({ email: 'secreto@mail.com', password: 'abc', nickname: 'luna' }, deps)
    assert.ok(!to.includes('secreto') && !to.includes('abc&') && !to.endsWith('abc'))
  })

  it('error de Supabase: "unavailable"; contraseña débil según Supabase: "password-short"', async () => {
    const { deps } = makeAuth({ signUp: async () => ({ error: { message: 'x' } }) })
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef' }, deps), '/registro?error=unavailable')
    const weak = makeAuth({ signUp: async () => ({ error: { code: 'weak_password' } }) })
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef' }, weak.deps), '/registro?error=password-short')
  })

  it('un correo ya registrado (Supabase responde sin error) da la misma ruta que uno nuevo', async () => {
    const fresh = makeAuth()
    const existing = makeAuth({ signUp: async () => ({ error: null }) })
    assert.equal(
      await signUpWithPassword({ email: 'nuevo@mail.com', password: 'abcdef' }, fresh.deps),
      await signUpWithPassword({ email: 'existente@mail.com', password: 'abcdef' }, existing.deps),
    )
  })
})

describe('signInWithPasswordCore', () => {
  it('ingresa y va a /account', async () => {
    const { deps, signIns } = makeAuth()
    assert.equal(await signInWithPasswordCore({ email: ' Ana@Mail.com ', password: 'abcdef' }, deps), '/account')
    assert.deepEqual(signIns, [{ email: 'ana@mail.com', password: 'abcdef' }])
  })

  it('cualquier fallo de Supabase es "credentials" (no distingue correo inexistente de contraseña errónea)', async () => {
    const { deps } = makeAuth({ signInWithPassword: async () => ({ error: { code: 'invalid_credentials', status: 400 } }) })
    assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: 'abcdef' }, deps), '/login?error=credentials')
    const other = makeAuth({ signInWithPassword: async () => ({ error: { code: 'email_not_confirmed', status: 400 } }) })
    assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: 'abcdef' }, other.deps), '/login?error=credentials')
  })

  it('contraseña vacía: "credentials" sin llamar a Supabase; correo inválido: "email"; límite: "rate"', async () => {
    const { deps, signIns } = makeAuth()
    assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: '' }, deps), '/login?error=credentials')
    assert.equal(await signInWithPasswordCore({ email: 'no-es-correo', password: 'abcdef' }, deps), '/login?error=email')
    assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: 'abcdef' }, { ...deps, allowRequest: () => false }), '/login?error=rate')
    assert.deepEqual(signIns, [])
  })

  it('si la llamada lanza, queda "unavailable" (no "incorrectas") sin propagar', async () => {
    const { deps } = makeAuth({
      signInWithPassword: async () => {
        throw new Error('red')
      },
    })
    assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: 'abcdef' }, deps), '/login?error=unavailable')
  })
})

function makeChange(overrides: Partial<ChangePasswordDeps> = {}) {
  const calls: string[] = []
  const updates: { password: string; data: { password_set: true } }[] = []
  const deps: ChangePasswordDeps = {
    allowAction: () => true,
    verifyCurrent: async () => {
      calls.push('verifyCurrent')
      return true
    },
    updateUser: async (args) => {
      calls.push('updateUser')
      updates.push(args)
      return { error: null }
    },
    refreshSession: async () => {
      calls.push('refreshSession')
      return { error: null }
    },
    ...overrides,
  }
  return { deps, calls, updates }
}

const change = { current: 'vieja123', password: 'nueva456', repeat: 'nueva456' }

describe('changePassword', () => {
  it('verifica la actual, guarda la nueva con la marca, refresca y confirma', async () => {
    const { deps, calls, updates } = makeChange()
    assert.equal(await changePassword(change, deps), '/account?password=ok')
    assert.deepEqual(calls, ['verifyCurrent', 'updateUser', 'refreshSession'])
    assert.deepEqual(updates, [{ password: 'nueva456', data: { password_set: true } }])
  })

  it('con la actual errónea no modifica nada', async () => {
    const { deps, calls } = makeChange({ verifyCurrent: async () => false })
    assert.equal(await changePassword(change, deps), '/account?error=password-wrong')
    assert.deepEqual(calls, [])
  })

  it('con la nueva igual a la actual, falta de la actual, corta o distinta: error sin llamar a Supabase', async () => {
    const { deps, calls } = makeChange()
    assert.equal(await changePassword({ current: 'abcdef', password: 'abcdef', repeat: 'abcdef' }, deps), '/account?error=password-same')
    assert.equal(await changePassword({ ...change, current: '' }, deps), '/account?error=password-current')
    assert.equal(await changePassword({ ...change, password: 'abc', repeat: 'abc' }, deps), '/account?error=password-short')
    assert.equal(await changePassword({ ...change, repeat: 'otra4567' }, deps), '/account?error=password-mismatch')
    assert.deepEqual(calls, [])
  })

  it('límite excedido: no verifica ni cambia', async () => {
    const { deps, calls } = makeChange({ allowAction: () => false })
    assert.equal(await changePassword(change, deps), '/account?error=rate')
    assert.deepEqual(calls, [])
  })

  it('un error de Supabase al guardar o refrescar es "password-unavailable", nunca éxito', async () => {
    const failUpdate = makeChange({ updateUser: async () => ({ error: { message: 'x' } }) })
    assert.equal(await changePassword(change, failUpdate.deps), '/account?error=password-unavailable')
    const failRefresh = makeChange({ refreshSession: async () => ({ error: { message: 'x' } }) })
    assert.equal(await changePassword(change, failRefresh.deps), '/account?error=password-unavailable')
    const throws = makeChange({
      verifyCurrent: async () => {
        throw new Error('red')
      },
    })
    assert.equal(await changePassword(change, throws.deps), '/account?error=password-unavailable')
  })
})

describe('arreglos de la revisión', () => {
  it('elegir contraseña: si la sesión no puede (ya tiene contraseña y no viene de un enlace) no cambia nada', async () => {
    const { deps, calls } = makeChoose({ canChoose: () => false })
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/account')
    assert.deepEqual(calls, [])
  })

  it('elegir contraseña: "same_password" tras un refresco fallido se trata como éxito y refresca igual', async () => {
    const { deps, calls } = makeChoose({ updateUser: async () => ({ error: { code: 'same_password' } }) })
    assert.equal(await choosePassword({ password: 'abcdef', repeat: 'abcdef' }, deps), '/account')
    assert.deepEqual(calls, ['refreshSession'])
  })

  it('ingreso: límite de Supabase (429) o fallo del servidor es "unavailable", no "credentials", y se registra el código sin el correo', async () => {
    for (const error of [{ status: 429, code: 'over_request_rate_limit' }, { status: 500 }, { status: 503 }]) {
      const reports: string[] = []
      const { deps } = makeAuth({ signInWithPassword: async () => ({ error }) })
      assert.equal(await signInWithPasswordCore({ email: 'secreto@mail.com', password: 'abcdef' }, { ...deps, report: (_scope, detail) => reports.push(detail) }), '/login?error=unavailable')
      assert.equal(reports.length, 1)
      assert.ok(!reports[0].includes('secreto'))
    }
  })

  it('ingreso: una llamada que lanza es "unavailable" y se registra', async () => {
    const reports: string[] = []
    const { deps } = makeAuth({
      signInWithPassword: async () => {
        throw new Error('red')
      },
    })
    assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: 'abcdef' }, { ...deps, report: (_s, d) => reports.push(d) }), '/login?error=unavailable')
    assert.equal(reports.length, 1)
  })

  it('ingreso: credenciales inválidas o correo sin confirmar siguen siendo "credentials" y no se registran', async () => {
    const reports: string[] = []
    for (const error of [{ status: 400, code: 'invalid_credentials' }, { status: 400, code: 'email_not_confirmed' }]) {
      const { deps } = makeAuth({ signInWithPassword: async () => ({ error }) })
      assert.equal(await signInWithPasswordCore({ email: 'a@b.co', password: 'abcdef' }, { ...deps, report: (_s, d) => reports.push(d) }), '/login?error=credentials')
    }
    assert.deepEqual(reports, [])
  })

  it('registro: un error de Supabase se registra', async () => {
    const reports: string[] = []
    const { deps } = makeAuth({ signUp: async () => ({ error: { status: 500, code: 'unexpected_failure' } }) })
    assert.equal(await signUpWithPassword({ email: 'a@b.co', password: 'abcdef' }, { ...deps, report: (_s, d) => reports.push(d) }), '/registro?error=unavailable')
    assert.equal(reports.length, 1)
  })

  it('cambio de contraseña: "same_password" tampoco bloquea y se refresca', async () => {
    const { deps, calls } = makeChange({ updateUser: async () => ({ error: { code: 'same_password' } }) })
    assert.equal(await changePassword(change, deps), '/account?password=ok')
    assert.deepEqual(calls, ['verifyCurrent', 'refreshSession'])
  })
})
