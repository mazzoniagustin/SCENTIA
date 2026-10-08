import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchCandidates } from '@/lib/candidates'
import { getUserCollectionEntries } from '@/lib/exclusions'
import { calculateSimilarityScore } from '@/lib/similarity'
import { getSessionDbUserId } from '@/lib/auth/db-user'

// Contrato de respuesta de GET /api/perfumes/[id]/recommendations.
// `reasons` explica de forma legible por qué el candidato está en el ranking:
// comparte acordes, notas, o ambos. El vocabulario es cerrado para que el
// cliente pueda renderizarlo sin lógica de inferencia.

type RecommendationReason = 'shared_accords' | 'shared_notes'

type Recommendation = {
  perfumeId: string
  brand: string
  name: string
  score: number
  reasons: RecommendationReason[]
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

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

// Determina los motivos de similitud comparando los identificadores compartidos
// con la referencia. No se repite el cálculo de scoring: solo se reutilizan los
// conjuntos de ids ya cargados.
function buildReasons(
  candidateAccordIds: ReadonlyArray<string>,
  candidateNoteIds: ReadonlyArray<string>,
  referenceAccordIds: ReadonlySet<string>,
  referenceNoteIds: ReadonlySet<string>,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = []
  if (candidateAccordIds.some((id) => referenceAccordIds.has(id))) {
    reasons.push('shared_accords')
  }
  if (candidateNoteIds.some((id) => referenceNoteIds.has(id))) {
    reasons.push('shared_notes')
  }
  return reasons
}

// Next 16: `params` es una Promise, se debe resolver con `await`.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    // Referencia: perfume sobre el que se calcula la similitud.
    const reference = await prisma.perfume.findUnique({
      where: { id },
      select: {
        id: true,
        accords: { select: { accordId: true, intensity: true } },
        notes: { select: { noteId: true, noteType: true } },
      },
    })
    if (!reference) {
      return NextResponse.json({ error: 'perfume no encontrado' }, { status: 404 })
    }

    const candidates = await fetchCandidates(id)

    // Exclusiones: solo si hay sesión y no se pidió includeOwned.
    const userId = includeOwned ? null : await getSessionDbUserId()
    const collection = await getUserCollectionEntries(userId)

    const referenceAccordIds = new Set(reference.accords.map((a) => a.accordId))
    const referenceNoteIds = new Set(reference.notes.map((n) => n.noteId))

    const scored = candidates
      .map((candidate) => ({
        candidate,
        score: calculateSimilarityScore(reference, candidate, collection),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ candidate, score }) => ({
        perfumeId: candidate.id,
        brand: candidate.brand,
        name: candidate.name,
        // Redondeo a 2 decimales en la capa de API; el score interno es pleno.
        score: Math.round(score * 100) / 100,
        reasons: buildReasons(
          (candidate.accords ?? []).map((a) => a.accordId),
          (candidate.notes ?? []).map((n) => n.noteId),
          referenceAccordIds,
          referenceNoteIds,
        ),
      }))

    return NextResponse.json({ data: scored, count: scored.length }, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}