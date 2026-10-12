import { logServerError } from '@/lib/log'
import { parsePlaceQuery } from '@/lib/weather/coords'
import { searchPlaces } from '@/lib/weather/open-meteo'
import { guardOutfitRequest, outfitJson } from '@/lib/outfit/request-guard'

// POST /api/outfit/places — body { query }. Busca ciudades en Open-Meteo para quien no da la ubicación.
// No se cachea ni se registra el texto buscado.
export async function POST(request: Request) {
  const guard = await guardOutfitRequest(request, 'outfit-places', 20)
  if (!guard.ok) return guard.response

  const query = parsePlaceQuery((guard.body as { query?: unknown } | null)?.query)
  if (!query) return outfitJson({ error: 'Escribí entre 2 y 80 caracteres' }, 400)

  try {
    const places = await searchPlaces(query)
    return outfitJson({ places })
  } catch (error) {
    logServerError('api/outfit/places', error)
    return outfitJson({ code: 'weather_unavailable', error: 'No pudimos buscar ciudades' }, 502)
  }
}
