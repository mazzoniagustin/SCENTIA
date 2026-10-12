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

// POST /api/outfit/today — body { latitude, longitude }. Recomienda un perfume de la colección según el
// clima. Ranking determinista; la frase con IA es opcional y nunca decide. La ubicación no se guarda ni
// se registra, y la respuesta no la devuelve.
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

    const result = recommendOutfit(candidates, profile)
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
    })
  } catch (error) {
    logServerError('api/outfit/today', error)
    return outfitJson({ error: 'Error interno del servidor' }, 500)
  }
}
