import { logServerError } from '@/lib/log'
import { limitAction } from '@/lib/rate-limit'
import { parseCoords } from '@/lib/weather/coords'
import { fetchWeather } from '@/lib/weather/open-meteo'
import { buildWeatherProfile } from '@/lib/outfit/profile'
import { recommendOutfit } from '@/lib/outfit/score'
import { getOutfitPhrase } from '@/lib/outfit/llm-phrase'
import { templatePhrase } from '@/lib/outfit/phrase'
import { countCollection, getOutfitCandidates } from '@/lib/outfit/data'
import { guardOutfitRequest, outfitJson } from '@/lib/outfit/request-guard'
import { describeContext, CONTEXT_NOT_UNDERSTOOD, type OutfitContext } from '@/lib/outfit/context'
import { interpretContext, isContextEnabled } from '@/lib/outfit/context-llm'

// POST /api/outfit/today — body { latitude, longitude }. Recomienda un perfume de la colección según el
// clima. Ranking determinista; la frase con IA es opcional y nunca decide. La ubicación no se guarda ni
// se registra, y la respuesta no la devuelve. Con `context` (texto libre, ADR-011) y OUTFIT_CONTEXT_LLM_ENABLED, un modelo lo
// traduce a filtros de listas cerradas que afinan el puntaje (p. ej. "lugar cerrado" baja a los perfumes invasivos); si la
// interpretación falla, la recomendación se devuelve igual, sin contexto, con un aviso.
export async function POST(request: Request) {
  const guard = await guardOutfitRequest(request, 'outfit', 10)
  if (!guard.ok) return guard.response

  const coords = parseCoords(guard.body)
  if (!coords) return outfitJson({ error: 'Ubicación inválida' }, 400)

  try {
    const [candidates, weatherResult] = await Promise.all([
      getOutfitCandidates(guard.userId),
      fetchWeather(coords).then(
        (weather) => ({ weather }),
        (error: unknown) => ({ error }),
      ),
    ])
    if ('error' in weatherResult) {
      logServerError('api/outfit/today', weatherResult.error)
      return outfitJson({ code: 'weather_unavailable', error: 'No pudimos consultar el clima' }, 502)
    }

    const profile = buildWeatherProfile(weatherResult.weather)
    const weather = {
      temperatureC: profile.temperatureC,
      apparentTemperatureC: profile.apparentTemperatureC,
      humidityPct: profile.humidityPct,
      precipitationMm: profile.precipitationMm,
      isDay: profile.isDay,
      band: profile.band,
      wet: profile.wet,
      humid: profile.humid,
    }

    const contextOutcome = await resolveContext(guard.body, guard.userId)
    const result = recommendOutfit(candidates, profile, contextOutcome.context)
    if (result.status === 'empty_collection' || result.status === 'no_wearable') {
      // Distingue "no cargaste nada" de "solo tenés deseados/no gustados".
      const total = candidates.length === 0 ? await countCollection(guard.userId) : candidates.length
      return outfitJson({ status: total === 0 ? 'empty_collection' : 'no_wearable', weather })
    }
    if (result.status !== 'ok') return outfitJson({ status: result.status, weather })

    // La IA tiene su propio límite por persona; si se supera, queda la plantilla.
    const llmAllowed = limitAction('outfit-llm', guard.userId, { limit: 4, windowMs: 60_000 }).ok
    const phrase = llmAllowed
      ? await getOutfitPhrase(profile, result.primary)
      : { text: templatePhrase(profile, result.primary), source: 'template' as const }

    return outfitJson({
      status: 'ok',
      weather,
      primary: result.primary,
      alternatives: result.alternatives,
      phrase,
      context: { enabled: isContextEnabled(), ...contextOutcome.info },
    })
  } catch (error) {
    logServerError('api/outfit/today', error)
    return outfitJson({ error: 'Error interno del servidor' }, 500)
  }
}

type ContextInfo =
  | { status: 'none' }
  | { status: 'applied'; summary: string }
  | { status: 'not_understood' | 'unavailable' | 'rate_limited' | 'invalid_text'; message: string }

/** Interpreta el texto de contexto del cuerpo, si vino y la función está habilitada. Nunca hace fallar la recomendación. */
async function resolveContext(body: unknown, userId: string): Promise<{ context: OutfitContext | null; info: ContextInfo }> {
  const raw = body !== null && typeof body === 'object' ? (body as Record<string, unknown>).context : undefined
  if (raw === undefined || raw === null || raw === '' || !isContextEnabled()) return { context: null, info: { status: 'none' } }
  if (!limitAction('outfit-context', userId, { limit: 3, windowMs: 60_000 }).ok) {
    return { context: null, info: { status: 'rate_limited', message: 'Esperá unos segundos para volver a contar tu plan.' } }
  }
  const interpreted = await interpretContext(raw)
  if (interpreted.status === 'ok') return { context: interpreted.context, info: { status: 'applied', summary: describeContext(interpreted.context) } }
  if (interpreted.status === 'invalid_text') return { context: null, info: { status: 'invalid_text', message: 'Escribí qué vas a hacer (hasta 200 caracteres).' } }
  if (interpreted.status === 'not_understood') return { context: null, info: { status: 'not_understood', message: CONTEXT_NOT_UNDERSTOOD } }
  return { context: null, info: { status: 'unavailable', message: 'No pudimos interpretar tu plan ahora. Te mostramos la recomendación sin ese dato.' } }
}
