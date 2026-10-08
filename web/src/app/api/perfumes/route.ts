import { type NextRequest, NextResponse } from 'next/server'
import type { Prisma, PriceTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Tipado estricto del where: solo los filtros que aplicamos
type PerfumeWhere = Prisma.PerfumeWhereInput

// Resultado del parseo de query params: null = params inválidos
type FilterResult =
  | { ok: true; where: PerfumeWhere; orderBy: Prisma.PerfumeOrderByWithRelationInput[]; ids: string[] }
  | { ok: false; error: string }

// Valores de orden aceptados. 'relevance' es placeholder del orden editorial
// (brand/name asc) hasta que exista scoring de relevancia real.
const SORT_VALUES = ['relevance', 'newest', 'duration-desc', 'duration-asc'] as const
type SortValue = (typeof SORT_VALUES)[number]

// Tie-break determinista: brand/name asc detrás del criterio principal.
const SORT_ORDER: Record<SortValue, Prisma.PerfumeOrderByWithRelationInput[]> = {
  relevance: [{ brand: 'asc' }, { name: 'asc' }],
  newest: [{ releaseYear: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  'duration-desc': [{ duration: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  'duration-asc': [{ duration: { sort: 'asc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
}

function parseSort(value: string | null): SortValue | null {
  if (value === null || value === '') {
    // Sin sort explícito, mismo default que siempre tuvo el endpoint
    return 'relevance'
  }
  return SORT_VALUES.includes(value as SortValue) ? (value as SortValue) : null
}

function parsePositiveInt(value: string, paramName: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

function buildFilters(searchParams: URLSearchParams): FilterResult {
  const where: PerfumeWhere = {}

  const brand = searchParams.get('brand')
  if (brand) {
    where.brand = { equals: brand, mode: 'insensitive' }
  }

  const ids = searchParams.get('ids')
  let requestedIds: string[] = []
  if (ids) {
    requestedIds = ids.split(',').map((id) => id.trim()).filter(Boolean)
    if (requestedIds.length < 2 || requestedIds.length > 4) {
      return { ok: false, error: 'ids requiere entre 2 y 4 identificadores' }
    }
    if (new Set(requestedIds).size !== requestedIds.length) {
      return { ok: false, error: 'ids no admite duplicados' }
    }
    where.id = { in: requestedIds }
  }

  const concentration = searchParams.get('concentration')
  if (concentration) {
    where.concentration = { equals: concentration, mode: 'insensitive' }
  }

  const gender = searchParams.get('gender')
  if (gender) {
    where.gender = { equals: gender, mode: 'insensitive' }
  }

  const season = searchParams.get('season')
  if (season) {
    // seasons es un array en el schema; hasSome busca coincidencia exacta dentro del array
    where.seasons = { has: season }
  }

  const occasion = searchParams.get('occasion')
  if (occasion) {
    where.occasions = { has: occasion }
  }

  const priceTier = searchParams.get('priceTier')
  if (priceTier) {
    if (!['ARABIC', 'DESIGNER', 'NICHE'].includes(priceTier)) {
      return { ok: false, error: 'priceTier inválido' }
    }
    where.priceTier = { equals: priceTier as PriceTier }
  }

  const minDurationParam = searchParams.get('minDuration')
  if (minDurationParam !== null) {
    const minDuration = parsePositiveInt(minDurationParam, 'minDuration')
    if (minDuration === null) {
      return { ok: false, error: 'minDuration debe ser un entero >= 0' }
    }
    where.duration = { ...(where.duration as Prisma.IntFilter | undefined), gte: minDuration }
  }

  const maxDurationParam = searchParams.get('maxDuration')
  if (maxDurationParam !== null) {
    const maxDuration = parsePositiveInt(maxDurationParam, 'maxDuration')
    if (maxDuration === null) {
      return { ok: false, error: 'maxDuration debe ser un entero >= 0' }
    }
    where.duration = { ...(where.duration as Prisma.IntFilter | undefined), lte: maxDuration }
  }

  if (
    where.duration &&
    typeof where.duration === 'object' &&
    where.duration.gte !== undefined &&
    where.duration.lte !== undefined &&
    (where.duration.gte as number) > (where.duration.lte as number)
  ) {
    return { ok: false, error: 'minDuration no puede ser mayor que maxDuration' }
  }

  const sort = parseSort(searchParams.get('sort'))
  if (sort === null) {
    return {
      ok: false,
      error: `sort inválido: debe ser uno de ${SORT_VALUES.join(', ')}`,
    }
  }

  return { ok: true, where, orderBy: SORT_ORDER[sort], ids: requestedIds }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const filters = buildFilters(searchParams)
    if (!filters.ok) {
      return NextResponse.json({ error: filters.error }, { status: 400 })
    }

    const perfumes = await prisma.perfume.findMany({
      where: filters.where,
      include: {
        notes: { include: { note: true } },
        accords: { include: { accord: true } },
      },
      orderBy: filters.orderBy,
    })

    // Con ids: el orden de data es el orden del param (el color de cada serie en
    // el comparador sigue esa posición) y sort se ignora — findMany no garantiza
    // el orden de un `in`, por eso se reordena en JS.
    if (filters.ids.length >= 2) {
      const byId = new Map(perfumes.map((perfume) => [perfume.id, perfume]))
      const ordered = filters.ids
        .map((id) => byId.get(id))
        .filter((perfume): perfume is (typeof perfumes)[number] => perfume !== undefined)
      const missing = filters.ids.filter((id) => !byId.has(id))
      return NextResponse.json(
        { data: ordered, count: ordered.length, missing },
        { status: 200 },
      )
    }

    return NextResponse.json({ data: perfumes, count: perfumes.length }, { status: 200 })
  } catch (error) {
    // Tipado estricto del error sin usar any
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
