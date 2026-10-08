import { type NextRequest, NextResponse } from 'next/server'
import { getSessionDbUserId } from '@/lib/auth/db-user'
import { limitRequest } from '@/lib/api-guard'
import { logServerError } from '@/lib/log'
import { DEFAULT_LIMIT, MAX_LIMIT, getSimilarPerfumes } from '@/lib/recommendations/similar'

// Contrato de respuesta de GET /api/perfumes/[id]/recommendations:
// { data: [{ perfumeId, brand, name, score, reasons }], count }. La lógica vive en
// src/lib/recommendations/similar.ts, compartida con la ficha del perfume.

// Parsea `limit` con límites: número entero entre 1 y MAX_LIMIT. Devuelve null
// (inválido) si el valor no es un entero positivo dentro del rango.
function parseLimit(raw: string | null): number | null {
  if (raw === null) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return null
  }
  return parsed
}

// Next 16: `params` es una Promise, se debe resolver con `await`.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = limitRequest(request, 'similares', 60)
  if (limited) return limited

  try {
    const { id } = await params
    const { searchParams } = request.nextUrl

    const limit = parseLimit(searchParams.get('limit'))
    if (limit === null) {
      return NextResponse.json(
        { error: `limit debe ser un entero entre 1 y ${MAX_LIMIT}` },
        { status: 400 },
      )
    }

    // includeOwned=true desactiva la exclusión (pensado para depuración o para
    // una UI que muestre "ya lo tenés"). Por defecto se excluyen owned/disliked.
    const includeOwned = searchParams.get('includeOwned') === 'true'
    const userId = includeOwned ? null : await getSessionDbUserId()

    const data = await getSimilarPerfumes(id, { limit, userId })
    if (data === null) {
      return NextResponse.json({ error: 'perfume no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data, count: data.length }, { status: 200 })
  } catch (error) {
    logServerError('api/perfumes/[id]/recommendations', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
