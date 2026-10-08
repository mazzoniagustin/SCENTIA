import { NextResponse } from 'next/server'
import { limitRequest } from '@/lib/api-guard'
import { logServerError } from '@/lib/log'
import { prisma } from '@/lib/prisma'

// GET /api/health — comprueba que la app responde y que la base conecta. Sirve para la prueba de humo del
// despliegue y, con el cron diario de vercel.json, evita que el proyecto gratuito de Supabase se pause por
// inactividad. No expone detalles del error ni de la configuración.
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const limited = limitRequest(request, 'health', 30)
  if (limited) return limited

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: true }, { status: 200, headers: NO_STORE })
  } catch (error) {
    logServerError('api/health', error)
    return NextResponse.json({ ok: false, db: false }, { status: 503, headers: NO_STORE })
  }
}
