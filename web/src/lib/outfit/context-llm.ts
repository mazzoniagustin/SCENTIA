// Interpretación con IA del texto de contexto de "¿Qué me pongo hoy?" (ADR-011). Impura: lee env y usa el cliente común de Gemini.
// Todo lo que devuelve pasó por `parseContext`: solo valores del vocabulario. Un solo intento; con fallo o enfriamiento, la
// recomendación se muestra igual, sin contexto.

import { generateText, isCoolingDown, LlmError, resetGeminiState } from '../llm/gemini.ts'
import { logServerError } from '../log.ts'
import { createTtlCache } from '../ttl-cache.ts'
import {
  buildContextSystemPrompt,
  buildContextUserData,
  contextCacheKey,
  parseContext,
  sanitizeContextText,
  type OutfitContext,
} from './context.ts'

export type ContextEnv = Record<string, string | undefined>

export type ContextDeps = {
  fetchImpl?: typeof fetch
  now?: () => number
  env?: ContextEnv
}

export type ContextResult =
  | { status: 'ok'; context: OutfitContext }
  | { status: 'invalid_text' }
  | { status: 'not_understood' }
  | { status: 'unavailable'; reason: 'disabled' | 'cooldown' | 'error' }

const TIMEOUT_MS = 8000
const CACHE_TTL_MS = 60 * 60 * 1000

const cache = createTtlCache<OutfitContext>({ ttlMs: CACHE_TTL_MS, maxEntries: 200 })

/** Solo para tests. */
export function resetContextState() {
  cache.clear()
  resetGeminiState()
}

/** El cuadro de contexto solo existe con su flag propio y la misma clave y modelo de las demás funciones con IA. */
export function isContextEnabled(env: ContextEnv = process.env): boolean {
  return env.OUTFIT_CONTEXT_LLM_ENABLED === 'true' && Boolean(env.GEMINI_API_KEY) && Boolean(env.GEMINI_MODEL)
}

class NotUnderstood extends Error {}
class CoolingDown extends Error {}

export async function interpretContext(rawText: unknown, deps: ContextDeps = {}): Promise<ContextResult> {
  const env = deps.env ?? process.env
  if (!isContextEnabled(env)) return { status: 'unavailable', reason: 'disabled' }
  const text = sanitizeContextText(rawText)
  if (text === null) return { status: 'invalid_text' }

  const now = (deps.now ?? Date.now)()
  try {
    // Solo se cachea lo que se entendió (un error o un "no entendí" lanzan y no quedan guardados).
    const context = await cache.getOrCompute(contextCacheKey(text), async () => {
      if (isCoolingDown(now)) throw new CoolingDown()
      const raw = await generateText({
        systemPrompt: buildContextSystemPrompt(),
        userData: buildContextUserData(text),
        apiKey: env.GEMINI_API_KEY as string,
        model: env.GEMINI_MODEL as string,
        fetchImpl: deps.fetchImpl ?? fetch,
        now,
        maxOutputTokens: 120,
        temperature: 0.1,
        timeoutMs: TIMEOUT_MS,
      })
      const parsed = parseContext(raw)
      if (parsed === null) throw new NotUnderstood()
      return parsed
    })
    return { status: 'ok', context }
  } catch (error) {
    if (error instanceof NotUnderstood) return { status: 'not_understood' }
    if (error instanceof CoolingDown) return { status: 'unavailable', reason: 'cooldown' }
    logServerError('outfit-context', error instanceof LlmError ? error : new LlmError())
    return { status: 'unavailable', reason: 'error' }
  }
}
