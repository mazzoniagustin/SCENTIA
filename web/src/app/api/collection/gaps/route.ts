import { getGapAnalysis } from '@/lib/gaps/data'
import { buildGapsResponse } from '@/lib/gaps/response'
import { logServerError } from '@/lib/log'
import { guardOutfitRequest, outfitJson } from '@/lib/outfit/request-guard'

// POST /api/collection/gaps — "¿Qué le falta a mi colección?". La colección sale de la sesión del servidor: el cuerpo
// (debe ser JSON, normalmente `{}`) no influye en nada. Sin IA: huecos y candidatos son deterministas y los textos son
// de plantilla. La respuesta (ver buildGapsResponse) nunca incluye notas, puntajes, el id de la persona ni ids de su
// colección. Reutiliza los pasos comunes de los endpoints privados de outfit: IP → 415 → 400 → 401 → 429 por persona.
const PER_USER_LIMIT_PER_MINUTE = 6

export async function POST(request: Request) {
  const guard = await guardOutfitRequest(request, 'collection-gaps', PER_USER_LIMIT_PER_MINUTE)
  if (!guard.ok) return guard.response

  try {
    const { timing, ...analysis } = await getGapAnalysis(guard.userId)
    // Para medir en Vercel: de dónde salieron las frecuencias del catálogo (memoria, caché compartida o base) y cuánto
    // tardó. Sin ids, sin colección: solo estado, origen y milisegundos.
    console.info(
      `[api/collection/gaps] status=${analysis.families.status} catalog=${timing.catalogSource} catalogMs=${timing.catalogMs} totalMs=${timing.totalMs}`,
    )
    return outfitJson(buildGapsResponse(analysis))
  } catch (error) {
    logServerError('api/collection/gaps', error)
    return outfitJson({ error: 'Error interno del servidor' }, 500)
  }
}
