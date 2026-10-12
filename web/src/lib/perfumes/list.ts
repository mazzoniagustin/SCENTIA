import type { Prisma, PriceTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createTtlCache } from '@/lib/ttl-cache'
import { normalizeGender, normalizeSeason } from './filter-labels'

// Tipado estricto del where: solo los filtros que aplicamos
type PerfumeWhere = Prisma.PerfumeWhereInput

// Resultado del parseo de query params: null = params inválidos
type FilterResult =
  | {
      ok: true
      where: PerfumeWhere
      orderBy: Prisma.PerfumeOrderByWithRelationInput[]
      ids: string[]
      page: number
      pageSize: number
    }
  | { ok: false; error: string }

// Valores de orden aceptados. 'relevance' es placeholder del orden editorial
// (brand/name asc) hasta que exista scoring de relevancia real.
const SORT_VALUES = ['relevance', 'newest', 'duration-desc', 'duration-asc', 'longevity-desc'] as const
type SortValue = (typeof SORT_VALUES)[number]

// Tie-break determinista: brand/name asc detrás del criterio principal.
const SORT_ORDER: Record<SortValue, Prisma.PerfumeOrderByWithRelationInput[]> = {
  relevance: [{ brand: 'asc' }, { name: 'asc' }],
  newest: [{ releaseYear: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  'duration-desc': [{ duration: { sort: 'desc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  'duration-asc': [{ duration: { sort: 'asc', nulls: 'last' } }, { brand: 'asc' }, { name: 'asc' }],
  // Duración votada por la comunidad (1-5), la que traen los perfumes importados del dataset de Kaggle.
  'longevity-desc': [{ longevity: { sort: 'desc', nulls: 'last' } }, { ratingCount: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
}

function parseSort(value: string | null): SortValue | null {
  if (value === null || value === '') {
    // Sin sort explícito, mismo default que siempre tuvo el endpoint
    return 'relevance'
  }
  return SORT_VALUES.includes(value as SortValue) ? (value as SortValue) : null
}

// Paginación: el catálogo tiene decenas de miles de perfumes, así que el listado nunca es completo.
const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 100
// Búsqueda y filtros por lista: límites para acotar el costo de la consulta.
const MAX_SEARCH_TOKENS = 5
const MAX_TOKEN_LENGTH = 50
const MAX_LIST_FILTERS = 3
// Un acorde "cuenta" para el filtro cuando tiene al menos esta intensidad en el perfume.
const ACCORD_FILTER_MIN_INTENSITY = 40

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null || value === '') return fallback
  if (!/^\d+$/.test(value)) return null
  const parsed = Number.parseInt(value, 10)
  return parsed >= min && parsed <= max ? parsed : null
}

function parseCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

function buildFilters(searchParams: URLSearchParams): FilterResult {
  // El catálogo público nunca muestra borradores (RF-01).
  const where: PerfumeWhere = { status: 'PUBLISHED' }
  const and: PerfumeWhere[] = []

  // Búsqueda por nombre y marca: cada palabra debe aparecer en la marca o en el nombre.
  const q = searchParams.get('q')
  if (q) {
    const tokens = q.trim().split(/\s+/).filter(Boolean)
    if (tokens.length > MAX_SEARCH_TOKENS || tokens.some((token) => token.length > MAX_TOKEN_LENGTH)) {
      return {
        ok: false,
        error: `q admite hasta ${MAX_SEARCH_TOKENS} palabras de ${MAX_TOKEN_LENGTH} caracteres`,
      }
    }
    for (const token of tokens) {
      and.push({
        OR: [
          { brand: { contains: token, mode: 'insensitive' } },
          { name: { contains: token, mode: 'insensitive' } },
        ],
      })
    }
  }

  // Acordes (en español, separados por coma): el perfume debe tener todos con intensidad suficiente.
  const accord = searchParams.get('accord')
  if (accord) {
    const accords = parseCsv(accord)
    if (accords.length === 0 || accords.length > MAX_LIST_FILTERS) {
      return { ok: false, error: `accord admite entre 1 y ${MAX_LIST_FILTERS} acordes separados por coma` }
    }
    for (const name of accords) {
      and.push({
        accords: {
          some: { accord: { name: { equals: name, mode: 'insensitive' } }, intensity: { gte: ACCORD_FILTER_MIN_INTENSITY } },
        },
      })
    }
  }

  // Notas (nombre exacto en inglés, separadas por coma): el perfume debe tenerlas todas.
  const note = searchParams.get('note')
  if (note) {
    const notes = parseCsv(note)
    if (notes.length === 0 || notes.length > MAX_LIST_FILTERS) {
      return { ok: false, error: `note admite entre 1 y ${MAX_LIST_FILTERS} notas separadas por coma` }
    }
    for (const name of notes) {
      and.push({ notes: { some: { note: { name: { equals: name, mode: 'insensitive' } } } } })
    }
  }
  if (and.length > 0) where.AND = and

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
    // Acepta alias (men, hombres, women...) y los lleva al valor guardado; el where canónico
    // también evita duplicar la caché de conteos. Un valor desconocido no devuelve resultados.
    where.gender = { equals: normalizeGender(gender) ?? gender, mode: 'insensitive' }
  }

  const season = searchParams.get('season')
  if (season) {
    // seasons es un array en el schema; hasSome busca coincidencia exacta dentro del array
    where.seasons = { has: normalizeSeason(season) ?? season }
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

  // Duración mínima votada (1-5, promedio de la comunidad).
  const minLongevityParam = searchParams.get('minLongevity')
  if (minLongevityParam !== null && minLongevityParam !== '') {
    const minLongevity = Number(minLongevityParam)
    if (!Number.isFinite(minLongevity) || minLongevity < 1 || minLongevity > 5) {
      return { ok: false, error: 'minLongevity debe ser un número entre 1 y 5' }
    }
    where.longevity = { gte: minLongevity }
  }

  const minDurationParam = searchParams.get('minDuration')
  if (minDurationParam !== null) {
    const minDuration = parsePositiveInt(minDurationParam)
    if (minDuration === null) {
      return { ok: false, error: 'minDuration debe ser un entero >= 0' }
    }
    where.duration = { ...(where.duration as Prisma.IntFilter | undefined), gte: minDuration }
  }

  const maxDurationParam = searchParams.get('maxDuration')
  if (maxDurationParam !== null) {
    const maxDuration = parsePositiveInt(maxDurationParam)
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

  const page = parseBoundedInt(searchParams.get('page'), 1, 1, 1_000_000)
  if (page === null) {
    return { ok: false, error: 'page debe ser un entero >= 1' }
  }
  const pageSize = parseBoundedInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
  if (pageSize === null) {
    return { ok: false, error: `pageSize debe ser un entero entre 1 y ${MAX_PAGE_SIZE}` }
  }

  return { ok: true, where, orderBy: SORT_ORDER[sort], ids: requestedIds, page, pageSize }
}

// El total depende solo de los filtros y cambia al importar o publicar: se guarda 5 minutos por combinación de filtros.
const countCache = createTtlCache<number>({ ttlMs: 5 * 60 * 1000, maxEntries: 500 })

export type ListResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Listado, búsqueda y filtros del catálogo (compartido por GET /api/perfumes y la página /perfumes,
 * que lo llama directo en lugar de pedírselo a sí misma por HTTP). `ok: false` = parámetros inválidos.
 */
export async function listPerfumes(searchParams: URLSearchParams): Promise<ListResult> {
  const filters = buildFilters(searchParams)
  if (!filters.ok) return { ok: false, error: filters.error }

  // Con ids (comparador): hasta 4 perfumes con todas sus notas y acordes. Sin ids (listado):
  // una página, solo con acordes, más el total para poder paginar.
  const isCompare = filters.ids.length >= 2
  const [perfumes, total] = await Promise.all([
    prisma.perfume.findMany({
      where: filters.where,
      include: isCompare
        ? { notes: { include: { note: true } }, accords: { include: { accord: true } } }
        : { accords: { include: { accord: true } } },
      orderBy: filters.orderBy,
      ...(isCompare ? {} : { skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    }),
    isCompare
      ? Promise.resolve(0)
      : countCache.getOrCompute(JSON.stringify(filters.where), () => prisma.perfume.count({ where: filters.where })),
  ])

  // Con ids: el orden de data es el orden del param (el color de cada serie en
  // el comparador sigue esa posición) y sort se ignora — findMany no garantiza
  // el orden de un `in`, por eso se reordena en JS.
  if (isCompare) {
    const byId = new Map(perfumes.map((perfume) => [perfume.id, perfume]))
    const ordered = filters.ids
      .map((id) => byId.get(id))
      .filter((perfume): perfume is (typeof perfumes)[number] => perfume !== undefined)
    const missing = filters.ids.filter((id) => !byId.has(id))
    return { ok: true, body: { data: ordered, count: ordered.length, missing } }
  }

  return {
    ok: true,
    body: {
      data: perfumes,
      count: perfumes.length,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  }
}
