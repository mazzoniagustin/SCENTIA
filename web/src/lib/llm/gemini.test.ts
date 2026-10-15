import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { generateText, isCoolingDown, LlmError, resetGeminiState, type GenerateTextOptions } from './gemini.ts'

const okBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })
const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })

function setup(handler: () => Response | Promise<Response>, overrides: Partial<GenerateTextOptions> = {}) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return handler()
  }) as unknown as typeof fetch
  const options: GenerateTextOptions = {
    systemPrompt: 'SISTEMA',
    userData: 'dato: uno',
    apiKey: 'SECRET-KEY-123',
    model: 'gemini-2.5-flash',
    fetchImpl,
    now: 1_000_000,
    maxOutputTokens: 80,
    temperature: 0.5,
    ...overrides,
  }
  return { calls, options }
}

beforeEach(() => resetGeminiState())

describe('cliente de Gemini', () => {
  it('arma la solicitud: clave en el header (nunca en la URL), datos entre <datos> y sistema aparte', async () => {
    const { calls, options } = setup(() => jsonRes(okBody('hola')))
    assert.equal(await generateText(options), 'hola')
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.endsWith('/models/gemini-2.5-flash:generateContent'))
    assert.ok(!calls[0].url.includes('SECRET-KEY-123'))
    assert.equal((calls[0].init.headers as Record<string, string>)['x-goog-api-key'], 'SECRET-KEY-123')
    const body = JSON.parse(String(calls[0].init.body))
    assert.equal(body.systemInstruction.parts[0].text, 'SISTEMA')
    assert.equal(body.contents[0].parts[0].text, '<datos>\ndato: uno\n</datos>')
    assert.deepEqual(body.generationConfig, { maxOutputTokens: 80, temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } })
  })

  it('thinkingBudget 0 solo con la familia 2.5', async () => {
    const { calls, options } = setup(() => jsonRes(okBody('x')), { model: 'gemini-3-pro' })
    await generateText(options)
    assert.ok(!('thinkingConfig' in JSON.parse(String(calls[0].init.body)).generationConfig))
  })

  it('un 429 enfría con Retry-After acotado entre 1 y 300 s', async () => {
    const { options } = setup(() => jsonRes({}, 429, { 'retry-after': '99999' }))
    await assert.rejects(generateText(options), LlmError)
    assert.equal(isCoolingDown(1_000_000 + 299_000), true)
    assert.equal(isCoolingDown(1_000_000 + 301_000), false)
  })

  it('un 5xx sin Retry-After enfría 60 s; un 4xx común no enfría', async () => {
    await assert.rejects(generateText(setup(() => jsonRes({}, 503)).options), LlmError)
    assert.equal(isCoolingDown(1_000_000 + 59_000), true)
    assert.equal(isCoolingDown(1_000_000 + 61_000), false)
    resetGeminiState()
    await assert.rejects(generateText(setup(() => jsonRes({}, 400)).options), LlmError)
    assert.equal(isCoolingDown(1_000_001), false)
  })

  it('un fallo de red o timeout enfría, y una respuesta vacía o ilegible lanza LlmError', async () => {
    await assert.rejects(generateText(setup(() => Promise.reject(new Error('red'))).options), LlmError)
    assert.equal(isCoolingDown(1_000_001), true)
    resetGeminiState()
    await assert.rejects(generateText(setup(() => jsonRes(okBody('   '))).options), /vacía/)
    await assert.rejects(generateText(setup(() => new Response('no es json')).options), /ilegible/)
  })

  it('resetGeminiState limpia el enfriamiento', async () => {
    await assert.rejects(generateText(setup(() => jsonRes({}, 429)).options), LlmError)
    resetGeminiState()
    assert.equal(isCoolingDown(1_000_001), false)
  })
})
