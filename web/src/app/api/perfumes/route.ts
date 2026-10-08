import { type NextRequest, NextResponse } from 'next/server'
import { limitRequest } from '@/lib/api-guard'
import { logServerError } from '@/lib/log'
import { listPerfumes } from '@/lib/perfumes/list'

// GET /api/perfumes — listado paginado (page, pageSize), búsqueda (q) y filtros. Con ids (2 a 4) devuelve
// los perfumes completos para el comparador. La lógica vive en src/lib/perfumes/list.ts.
export async function GET(request: NextRequest) {
  const limited = limitRequest(request, 'perfumes', 120)
  if (limited) return limited

  try {
    const result = await listPerfumes(request.nextUrl.searchParams)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    // El listado es público (no depende de la sesión): el CDN lo puede servir 60 s y renovarlo en segundo plano.
    return NextResponse.json(result.body, {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    // El detalle (puede incluir consultas o nombres internos) va al log, no al cliente.
    logServerError('api/perfumes', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
