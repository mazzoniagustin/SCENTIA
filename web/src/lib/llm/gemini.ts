// Cliente mínimo de Gemini (REST `generateContent`), común a todas las funciones con IA de Scentia. Impuro: usa fetch.
// Solo servidor: no usa `import 'server-only'` para poder probarse con node:test; la clave nunca es NEXT_PUBLIC y va en un header,
// nunca en la URL. Un solo intento con timeout corto, y un enfriamiento COMPARTIDO por proceso: si el proveedor limita o falla
// (429, 5xx, timeout, red), ninguna función con IA lo vuelve a llamar hasta que pase el enfriamiento.
//
// [CONFIRMAR] contra la doc oficial (ai.google.dev, consultada 2026-10-12): la página text-generation ahora documenta la
// Interactions API (/v1beta/interactions, system_instruction, generation_config, thinking_level) y no generateContent. Se usa
// generateContent (formato clásico: systemInstruction, contents, generationConfig, candidates[0].content.parts[].text) pero hay
// que confirmar que sigue vigente para el modelo elegido. También [CONFIRMAR]: thinkingBudget 0 solo vale para la familia 2.5
// (en modelos 3.x se usa thinkingLevel y podría rechazarse), cuotas del plan gratuito (la doc de rate-limits remite a AI Studio)
// y si un 429 trae Retry-After (la doc no lo menciona; se lee si viene).

export class LlmError extends Error {
  constructor(message = 'Falló la generación de la frase') {
    super(message)
    this.name = 'LlmError'
  }
}

const DEFAULT_COOLDOWN_S = 60
const MAX_COOLDOWN_S = 300
const DEFAULT_TIMEOUT_MS = 8000

let cooldownUntil = 0

/** true mientras el proveedor está en enfriamiento: no hay que llamarlo ni cachear nada. */
export function isCoolingDown(now: number): boolean {
  return now < cooldownUntil
}

/** Solo para tests. */
export function resetGeminiState() {
  cooldownUntil = 0
}

function startCooldown(now: number, retryAfter: string | null) {
  const parsed = retryAfter !== null && /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter) : DEFAULT_COOLDOWN_S
  const seconds = Math.min(Math.max(parsed, 1), MAX_COOLDOWN_S)
  cooldownUntil = now + seconds * 1000
}

export type GenerateTextOptions = {
  /** Instrucciones fijas de la función (nunca datos de la persona). */
  systemPrompt: string
  /** Datos ya saneados; van entre <datos> y </datos> y el prompt de sistema pide tratarlos solo como datos. */
  userData: string
  apiKey: string
  model: string
  fetchImpl: typeof fetch
  now: number
  maxOutputTokens: number
  temperature: number
  timeoutMs?: number
}

/** Texto crudo del modelo; lanza LlmError ante cualquier fallo. La validación del texto es de quien llama. */
export async function generateText(options: GenerateTextOptions): Promise<string> {
  const { systemPrompt, userData, apiKey, model, fetchImpl, now } = options
  const generationConfig: Record<string, unknown> = { maxOutputTokens: options.maxOutputTokens, temperature: options.temperature }
  if (/2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }

  let res: Response
  try {
    res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `<datos>\n${userData}\n</datos>` }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch {
    startCooldown(now, null) // timeout o red caída: no insistir en cada solicitud
    throw new LlmError('Sin respuesta del proveedor')
  }

  if (res.status === 429 || res.status >= 500) {
    startCooldown(now, res.headers.get('retry-after'))
    throw new LlmError('El proveedor limitó o falló')
  }
  if (!res.ok) throw new LlmError('Respuesta no exitosa del proveedor')

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new LlmError('Respuesta ilegible del proveedor')
  }
  const parts = (json as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })?.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') : ''
  if (text.trim() === '') throw new LlmError('Respuesta vacía del proveedor')
  return text
}
