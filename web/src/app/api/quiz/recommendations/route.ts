import { type NextRequest, NextResponse } from 'next/server'
import { getSessionDbUserId } from '@/lib/auth/db-user'
import { validateAnswers } from '@/lib/quiz/profile'
import { QUIZ_GENDERS, recommendFromAnswers, type QuizGender } from '@/lib/quiz/recommend'

// POST /api/quiz/recommendations
// Body: { answers: QuizAnswers, gender?: 'femenino' | 'masculino' | 'unisex', limit?: 1-50 }
// Respuesta: { data: [{ perfumeId, brand, name, gender, score, matchedAccords, reasons }], count }
// Determinista y sin IA. Con sesión, excluye lo que la persona ya tiene o descartó.

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('el cuerpo debe ser JSON válido')
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return badRequest('el cuerpo debe ser un objeto')
    }
    const { answers: rawAnswers, gender, limit: rawLimit } = body as Record<string, unknown>

    const validated = validateAnswers(rawAnswers)
    if (!validated.ok) return badRequest(validated.error)

    if (gender !== undefined && !(QUIZ_GENDERS as readonly unknown[]).includes(gender)) {
      return badRequest(`gender debe ser uno de: ${QUIZ_GENDERS.join(', ')}`)
    }

    const limit = rawLimit === undefined ? DEFAULT_LIMIT : rawLimit
    if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_LIMIT) {
      return badRequest(`limit debe ser un entero entre 1 y ${MAX_LIMIT}`)
    }

    const data = await recommendFromAnswers(validated.answers, {
      gender: gender as QuizGender | undefined,
      limit: limit as number,
      userId: await getSessionDbUserId(),
    })
    return NextResponse.json({ data, count: data.length }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
