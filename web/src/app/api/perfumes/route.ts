import { type NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Tipado estricto del where: solo los filtros que aplicamos
type PerfumeWhere = Prisma.PerfumeWhereInput

// Resultado del parseo de query params: null = params inválidos
type FilterResult =
  | { ok: true; where: PerfumeWhere }
  | { ok: false; error: string }

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

  return { ok: true, where }
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
      orderBy: [{ brand: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ data: perfumes, count: perfumes.length }, { status: 200 })
  } catch (error) {
    // Tipado estricto del error sin usar any
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
