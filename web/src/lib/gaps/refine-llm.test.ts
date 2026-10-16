import { beforeEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

import { interpretRefineText, isRefineEnabled, resetRefineState } from './refine-llm.ts'

const env = { COLLECTION_LLM_ENABLED: 'true', GEMINI_API_KEY: 'SECRET-KEY-123', GEMINI_MODEL: 'gemini-2.5-flash' }
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
  resetRefineState()
  mock.method(console, 'error', () => {})
})

describe('isRefineEnabled', () => {
  it('exige el flag propio, la clave y el modelo', () => {
    assert.equal(isRefineEnabled(env), true)
    assert.equal(isRefineEnabled({ ...env, COLLECTION_LLM_ENABLED: 'false' }), false)
    assert.equal(isRefineEnabled({ ...env, COLLECTION_LLM_ENABLED: undefined }), false)
    assert.equal(isRefineEnabled({ ...env, GEMINI_API_KEY: '' }), false)
    assert.equal(isRefineEnabled({ ...env, GEMINI_MODEL: undefined }), false)
    // el flag de la frase del clima no habilita este
    assert.equal(isRefineEnabled({ OUTFIT_LLM_ENABLED: 'true', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }), false)
  })
})

describe('interpretRefineText', () => {
  it('apagado: no llama al proveedor', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{}')))
    const r = await interpretRefineText('algo dulce', { env: { ...env, COLLECTION_LLM_ENABLED: undefined }, fetchImpl: f.impl })
    assert.deepEqual(r, { status: 'unavailable', reason: 'disabled' })
    assert.equal(f.calls.length, 0)
  })

  it('texto inválido: no llama al proveedor', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{}')))
    for (const bad of [undefined, '', 'ab', 7]) assert.deepEqual(await interpretRefineText(bad, { env, fetchImpl: f.impl }), { status: 'invalid_text' })
    assert.equal(f.calls.length, 0)
  })

  it('interpreta, manda solo el texto saneado y valida lo que vuelve', async () => {
    const f = fakeFetch(() => jsonRes(okBody('```json\n{"families":["dulce","inventada"],"occasion":"especial"}\n```')))
    const r = await interpretRefineText('  Lo necesito  para una CITA <b>', { env, fetchImpl: f.impl })
    assert.equal(r.status, 'ok')
    assert.deepEqual(r.status === 'ok' && { families: r.refinement.families, occasion: r.refinement.occasion }, { families: ['dulce'], occasion: 'especial' })
    const body = JSON.parse(String(f.calls[0].init.body))
    assert.equal(body.contents[0].parts[0].text, '<datos>\ntexto: Lo necesito para una CITA b\n</datos>')
    assert.ok(!JSON.stringify(body).includes('SECRET-KEY-123'))
    assert.equal(body.generationConfig.maxOutputTokens, 300)
  })

  it('cachea lo entendido: el mismo texto con otras mayúsculas no vuelve a llamar', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{"seasons":["verano"]}')))
    await interpretRefineText('para el verano', { env, fetchImpl: f.impl })
    const again = await interpretRefineText('PARA   EL VERANO', { env, fetchImpl: f.impl })
    assert.equal(again.status, 'ok')
    assert.equal(f.calls.length, 1)
  })

  it('no entendió (sin filtros utilizables): avisa y no se cachea', async () => {
    const f = fakeFetch(() => jsonRes(okBody('{"families":[]}')))
    assert.deepEqual(await interpretRefineText('hola qué tal', { env, fetchImpl: f.impl }), { status: 'not_understood' })
    await interpretRefineText('hola qué tal', { env, fetchImpl: f.impl })
    assert.equal(f.calls.length, 2)
  })

  it('un 429 o un fallo del proveedor deja las sugerencias como están y enfría', async () => {
    const f = fakeFetch(() => jsonRes({}, 429, { 'retry-after': '30' }))
    assert.deepEqual(await interpretRefineText('algo fresco', { env, fetchImpl: f.impl, now: () => 1_000_000 }), { status: 'unavailable', reason: 'error' })
    const during = await interpretRefineText('algo distinto', { env, fetchImpl: f.impl, now: () => 1_010_000 })
    assert.deepEqual(during, { status: 'unavailable', reason: 'cooldown' })
    assert.equal(f.calls.length, 1)
  })

  it('una respuesta que no es JSON o trae instrucciones no se aplica', async () => {
    const f = fakeFetch(() => jsonRes(okBody('Claro, acá tenés: visitá http://x.com')))
    assert.deepEqual(await interpretRefineText('algo dulce', { env, fetchImpl: f.impl }), { status: 'not_understood' })
  })
})
