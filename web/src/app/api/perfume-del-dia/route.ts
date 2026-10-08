import { NextResponse } from 'next/server'
import { getSessionDbUserId } from '@/lib/auth/db-user'
import { limitRequest } from '@/lib/api-guard'
import { logServerError } from '@/lib/log'
import { getDailyPerfume } from '@/lib/daily/pick'

// GET /api/perfume-del-dia — el perfume del día según la estación (hemisferio por el país de las
// preferencias; por defecto sur). Con perfil del quiz guardado se personaliza. Sin IA: misma fecha,
// mismo resultado. Respuesta: { data: DailyPerfume } o 404 si ningún perfume cumple.
export async function GET(request: Request) {
  const limited = limitRequest(request, 'perfume-del-dia', 60)
  if (limited) return limited

  try {
    const data = await getDailyPerfume({ userId: await getSessionDbUserId() })
    if (!data) return NextResponse.json({ error: 'no hay un perfume del día disponible' }, { status: 404 })
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    logServerError('api/perfume-del-dia', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
