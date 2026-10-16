// Interpretación con IA del texto de "afinar" (ADR-010). Impura: lee env y usa el cliente común de Gemini. Todo lo que devuelve
// pasó por `parseRefinement`: solo valores del vocabulario. Un solo intento; si hay fallo o enfriamiento, no se afina.

import { logServerError } from '../log.ts'
import { generateText, isCoolingDown, LlmError, resetGeminiState } from '../llm/gemini.ts'
import { createTtlCache } from '../ttl-cache.ts'
import {
  buildRefineSystemPrompt,
  buildRefineUserData,
  parseRefinement,
  refineCacheKey,
  sanitizeRefineText,
  type Refinement,
} from './refine.ts'

export type RefineEnv = Record<string, string | undefined>

export type RefineDeps = {
  fetchImpl?: typeof fetch
  now?: () => number
  env?: RefineEnv
}

export type RefineResult =
  | { status: 'ok'; refinement: Refinement }
  | { status: 'invalid_text' }
  | { status: 'not_understood' }
  | { status: 'unavailable'; reason: 'disabled' | 'cooldown' | 'error' }

const TIMEOUT_MS = 8000
const CACHE_TTL_MS = 60 * 60 * 1000

const cache = createTtlCache<Refinement>({ ttlMs: CACHE_TTL_MS, maxEntries: 200 })

/** Solo para tests. */
export function resetRefineState() {
  cache.clear()
  resetGeminiState()
}

/** El cuadro para afinar solo existe con el flag propio y la misma clave y modelo de las demás funciones con IA. */
export function isRefineEnabled(env: RefineEnv = process.env): boolean {
  return env.COLLECTION_LLM_ENABLED === 'true' && Boolean(env.GEMINI_API_KEY) && Boolean(env.GEMINI_MODEL)
}

class NotUnderstood extends Error {}
class CoolingDown extends Error {}

export async function interpretRefineText(rawText: unknown, deps: RefineDeps = {}): Promise<RefineResult> {
  const env = deps.env ?? process.env
  if (!isRefineEnabled(env)) return { status: 'unavailable', reason: 'disabled' }
  const text = sanitizeRefineText(rawText)
  if (text === null) return { status: 'invalid_text' }

  const now = (deps.now ?? Date.now)()
  try {
    // Solo se cachea lo que se entendió (un error o un "no entendí" lanzan y no quedan guardados).
    const refinement = await cache.getOrCompute(refineCacheKey(text), async () => {
      if (isCoolingDown(now)) throw new CoolingDown()
      const raw = await generateText({
        systemPrompt: buildRefineSystemPrompt(),
        userData: buildRefineUserData(text),
        apiKey: env.GEMINI_API_KEY as string,
        model: env.GEMINI_MODEL as string,
        fetchImpl: deps.fetchImpl ?? fetch,
        now,
        maxOutputTokens: 300,
        temperature: 0.1,
        timeoutMs: TIMEOUT_MS,
      })
      const parsed = parseRefinement(raw)
      if (parsed === null) throw new NotUnderstood()
      return parsed
    })
    return { status: 'ok', refinement }
  } catch (error) {
    if (error instanceof NotUnderstood) return { status: 'not_understood' }
    if (error instanceof CoolingDown) return { status: 'unavailable', reason: 'cooldown' }
    logServerError('collection-refine', error instanceof LlmError ? error : new LlmError())
    return { status: 'unavailable', reason: 'error' }
  }
}
