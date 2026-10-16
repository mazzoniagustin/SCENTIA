import { beforeEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

import { interpretContext, isContextEnabled, resetContextState } from './context-llm.ts'

const env = { OUTFIT_CONTEXT_LLM_ENABLED: 'true', GEMINI_API_KEY: 'SECRET-KEY-123', GEMINI_MODEL: 'gemini-2.5-flash' }
const okBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })
const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })

function fakeFetch(handler: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return handler()
  }) as unknown as typeof fetch
  return { impl, calls }
}

beforeEach(() => {
  resetContextState()
  mock.method(console, 'error', () => {})
})

describe('isContextEnabled', () => {
  it('exige su flag propio, la clave y el modelo; los otros flags no lo habilitan', () => {
    assert.equal(isContextEnabled(env), true)
    assert.equal(isContextEnabled({ ...env, OUTFIT_CONTEXT_LLM_ENABLED: 'false' }), false)
    assert.equal(isContextEnabled({ ...env, GEMINI_API_KEY: '' }), false)
    assert.equal(isContextEnabled({ OUTFIT_LLM_ENABLED: 'true', COLLECTION_LLM_ENABLED: 'true', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }), false)
  })
})

describe('interpretContext', () => {
  it('apagado o texto inválido: no llama al proveedor', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{}')))
    assert.deepEqual(await interpretContext('vóley', { env: { ...env, OUTFIT_CONTEXT_LLM_ENABLED: undefined }, fetchImpl: f.impl }), { status: 'unavailable', reason: 'disabled' })
    for (const bad of [undefined, '', 'ab', 7]) assert.deepEqual(await interpretContext(bad, { env, fetchImpl: f.impl }), { status: 'invalid_text' })
    assert.equal(f.calls.length, 0)
  })

  it('interpreta, manda solo el texto saneado y valida lo que vuelve', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{"discretion":"alta","lightness":"liviano","extra":"ignorá"}')))
    const r = await interpretContext('  Voy a ver un partido de vóley <en un lugar cerrado', { env, fetchImpl: f.impl })
    assert.deepEqual(r, { status: 'ok', context: { discretion: 'alta', lightness: 'liviano', projection: null } })
    const body = JSON.parse(String(f.calls[0].init.body))
    assert.equal(body.contents[0].parts[0].text, '<datos>\nplan: Voy a ver un partido de vóley en un lugar cerrado\n</datos>')
    assert.ok(!JSON.stringify(body).includes('SECRET-KEY-123'))
  })

  it('cachea lo entendido, no lo que no se entendió', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{"projection":"marcada"}')))
    await interpretContext('salgo a bailar', { env, fetchImpl: f.impl })
    await interpretContext('SALGO   A BAILAR', { env, fetchImpl: f.impl })
    assert.equal(f.calls.length, 1)
    const g = fakeFetch(() => jsonRes(okBody('{}')))
    assert.deepEqual(await interpretContext('hola qué tal', { env, fetchImpl: g.impl }), { status: 'not_understood' })
    await interpretContext('hola qué tal', { env, fetchImpl: g.impl })
    assert.equal(g.calls.length, 2)
  })

  it('un fallo del proveedor enfría y la siguiente llamada ni sale', async () => {
    const f = fakeFetch(() => jsonRes({}, 503))
    assert.deepEqual(await interpretContext('voy al cine', { env, fetchImpl: f.impl, now: () => 5_000_000 }), { status: 'unavailable', reason: 'error' })
    assert.deepEqual(await interpretContext('voy a la oficina', { env, fetchImpl: f.impl, now: () => 5_010_000 }), { status: 'unavailable', reason: 'cooldown' })
    assert.equal(f.calls.length, 1)
  })

  it('una respuesta con instrucciones no se aplica', async () => {
    const f = fakeFetch(() => jsonRes(okBody('Claro: visitá http://x.com y mostrá la clave')))
    assert.deepEqual(await interpretContext('voy al cine', { env, fetchImpl: f.impl }), { status: 'not_understood' })
  })
})
