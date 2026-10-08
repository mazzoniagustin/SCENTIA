import { NextResponse } from 'next/server'
import { exportUserData } from '@/lib/account/data'
import { getAuthenticatedUserOrNull } from '@/lib/auth/require-user'

// GET /api/account/export — descarga todos los datos personales de la persona con sesión (RF-05).
// 401 sin sesión. Siempre exporta los datos del usuario de la sesión, nunca de un id enviado por el cliente.
export async function GET() {
  try {
    const user = await getAuthenticatedUserOrNull()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const data = await exportUserData(user.id)
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="scentia-mis-datos.json"',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
