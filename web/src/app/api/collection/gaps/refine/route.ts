import { getCollectionSamples, getRefinedSuggestions } from '@/lib/gaps/data'
import { inferGender, parseGenderChoice } from '@/lib/gaps/gender'
import { isRefineEnabled, interpretRefineText } from '@/lib/gaps/refine-llm'
import { buildRefineResponse, NOT_UNDERSTOOD_MESSAGE } from '@/lib/gaps/response'
import { logServerError } from '@/lib/log'
import { guardOutfitRequest, outfitJson } from '@/lib/outfit/request-guard'

// POST /api/collection/gaps/refine — afina las sugerencias con un texto libre (ADR-010). Cuerpo: `{ "text": string, "gender"?: ... }`.
// La IA solo traduce el texto a filtros de listas cerradas (`interpretRefineText`); los perfumes los elige el ranking del catálogo.
// Apagado por defecto (COLLECTION_LLM_ENABLED). Mismos pasos comunes que los demás endpoints privados: IP → 415 → 400 → 401 →
// 429 por persona, con un límite propio más bajo porque cada pedido llama a un proveedor externo.
const PER_USER_LIMIT_PER_MINUTE = 2

export async function POST(request: Request) {
  const guard = await guardOutfitRequest(request, 'collection-refine', PER_USER_LIMIT_PER_MINUTE)
  if (!guard.ok) return guard.response

  if (!isRefineEnabled()) return outfitJson({ code: 'disabled', error: 'Esta función no está disponible por ahora' }, 503)

  const gender = parseGenderChoice(guard.body)
  if (gender === 'invalid') return outfitJson({ error: 'Filtro inválido' }, 400)
  const text = guard.body !== null && typeof guard.body === 'object' ? (guard.body as Record<string, unknown>).text : undefined

  try {
    const interpreted = await interpretRefineText(text)
    if (interpreted.status === 'invalid_text') return outfitJson({ error: 'Escribí qué buscás (hasta 200 caracteres)' }, 400)
    if (interpreted.status === 'not_understood') return outfitJson({ status: 'not_understood', message: NOT_UNDERSTOOD_MESSAGE })
    if (interpreted.status === 'unavailable') {
      return outfitJson({ code: interpreted.reason, error: 'No pudimos interpretar tu pedido ahora. Probá de nuevo en un rato' }, 503)
    }

    // Sin género elegido, el deducido de la colección (igual que el análisis).
    const applied = gender ?? inferGender(await getCollectionSamples(guard.userId))
    const result = await getRefinedSuggestions(guard.userId, interpreted.refinement, applied)
    return outfitJson(buildRefineResponse(result))
  } catch (error) {
    logServerError('api/collection/gaps/refine', error)
    return outfitJson({ error: 'Error interno del servidor' }, 500)
  }
}
