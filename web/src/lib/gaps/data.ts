import 'server-only'

// Capa de datos de "¿Qué le falta a mi colección?". Solo lectura. Lee la colección de la persona sin notas privadas
// ni puntajes, calcula las frecuencias del catálogo con SQL agregado (nunca trae las 41 mil filas a memoria) y busca
// candidatos con un pre-filtro SQL acotado por necesidad, con el patrón de quiz/recommend.ts. El análisis y el
// ranking son los módulos puros de esta carpeta; acá solo se arman sus entradas.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAccordStats } from '@/lib/accord-stats'
import { buildIdf } from '@/lib/quiz/scoring'
import { SEASONS } from '@/lib/seasons'
import { sharedCache } from '@/lib/shared-cache'
import { createTtlCache } from '@/lib/ttl-cache'
import {
  ACCORD_PRESENCE_MIN_INTENSITY,
  analyzeFamilies,
  familySharesFromCounts,
  type FamilyCounts,
} from './analyze'
import {
  DIMENSIONS,
  DIMENSION_VALUES,
  DURATION_LONG_FROM,
  DURATION_SHORT_BELOW,
  SILLAGE_SOFT_BELOW,
  SILLAGE_STRONG_FROM,
  analyzeDimensions,
  dimensionSharesFromCounts,
  type Dimension,
  type DimensionCounts,
  type DimensionShares,
  type DimensionsReport,
} from './dimensions'
import { FAMILY_ACCORDS, FAMILY_ORDER, type FamilyCode } from './families'
import { allowedGenders, inferGender, resolveGender, type GenderFilter, type GenderState } from './gender'
import {
  EXCLUDED_FROM_SUGGESTIONS,
  buildNeeds,
  rankSuggestions,
  type Need,
  type RankCandidate,
  type Suggestion,
} from './rank'
import type { CatalogShares, CollectionSample, CollectionStatus, FamilyReport } from './types'

/** Tope de entradas de la colección que se leen (acota la consulta y el trabajo del análisis). */
export const MAX_COLLECTION_ENTRIES = 500
/** Candidatos del catálogo que se traen por necesidad (los más valorados que la cubren). */
export const POOL_PER_NEED = 80

const CATALOG_TTL_MS = 60 * 60 * 1000

// ---------------------------------------------------------------------------------------------
// Colección de la persona

/**
 * Perfumes publicados de la colección, con lo mínimo para el análisis. NO se selecciona `rating` ni `personalNotes`:
 * lo que no se lee no puede llegar por error a un informe, a un registro ni a un modelo.
 */
export async function getCollectionSamples(userId: string): Promise<CollectionSample[]> {
  // Una sola consulta (el select anidado de Prisma hace una ida y vuelta por nivel, ~250 ms cada una desde acá).
  const rows = await prisma.$queryRaw<
    Array<{
      perfumeId: string
      status: CollectionStatus
      gender: string
      seasons: string[]
      occasions: string[]
      longevity: number | null
      sillage: number | null
      accord: string | null
      intensity: number | null
    }>
  >`
    SELECT c."perfumeId", c.status::text AS status, p.gender, p.seasons, p.occasions, p.longevity, p.sillage,
           a.name AS accord, pa.intensity::int AS intensity
    FROM (
      SELECT uc."perfumeId", uc.status FROM "UserCollection" uc
      WHERE uc."userId" = ${userId} ORDER BY uc."perfumeId" LIMIT ${MAX_COLLECTION_ENTRIES}
    ) c
    JOIN "Perfume" p ON p.id = c."perfumeId" AND p.status = 'PUBLISHED'
    LEFT JOIN "PerfumeAccord" pa ON pa."perfumeId" = p.id
    LEFT JOIN "Accord" a ON a.id = pa."accordId"
    ORDER BY c."perfumeId", a.name`
  const byId = new Map<string, CollectionSample>()
  for (const row of rows) {
    let sample = byId.get(row.perfumeId)
    if (!sample) {
      sample = {
        perfumeId: row.perfumeId,
        status: row.status,
        accords: [],
        gender: row.gender,
        seasons: row.seasons,
        occasions: row.occasions,
        longevity: row.longevity,
        sillage: row.sillage,
      }
      byId.set(row.perfumeId, sample)
    }
    if (row.accord !== null && row.intensity !== null) sample.accords.push({ name: row.accord, intensity: row.intensity })
  }
  return [...byId.values()]
}

// ---------------------------------------------------------------------------------------------
// Predicados SQL de cada valor. Una sola definición para contar el catálogo y para buscar candidatos; deben coincidir
// con `profileOf` (dimensions.ts), y scripts/gaps-sql.test.ts lo verifica contra la base.

const VALID_LONGEVITY = Prisma.sql`p.longevity IS NOT NULL AND p.longevity <> 'NaN'::float8`
const VALID_SILLAGE = Prisma.sql`p.sillage IS NOT NULL AND p.sillage <> 'NaN'::float8`

function hasDataSql(dimension: Dimension): Prisma.Sql {
  switch (dimension) {
    case 'season':
      return Prisma.sql`p.seasons && ${[...SEASONS]}::text[]`
    case 'dayNight':
      return Prisma.sql`p.occasions && ARRAY['diario', 'noche']::text[]`
    case 'duration':
      return VALID_LONGEVITY
    case 'sillage':
      return VALID_SILLAGE
  }
}

/** Predicado de "el perfume p tiene este valor". FALSE para valores desconocidos. */
function valueSql(dimension: Dimension, value: string): Prisma.Sql {
  switch (dimension) {
    case 'season':
      return (SEASONS as readonly string[]).includes(value) ? Prisma.sql`${value} = ANY(p.seasons)` : Prisma.sql`FALSE`
    case 'dayNight':
      return value === 'dia'
        ? Prisma.sql`'diario' = ANY(p.occasions)`
        : value === 'noche'
          ? Prisma.sql`'noche' = ANY(p.occasions)`
          : Prisma.sql`FALSE`
    case 'duration':
      return value === 'corta'
        ? Prisma.sql`(${VALID_LONGEVITY} AND p.longevity < ${DURATION_SHORT_BELOW})`
        : value === 'media'
          ? Prisma.sql`(${VALID_LONGEVITY} AND p.longevity >= ${DURATION_SHORT_BELOW} AND p.longevity < ${DURATION_LONG_FROM})`
          : value === 'larga'
            ? Prisma.sql`(${VALID_LONGEVITY} AND p.longevity >= ${DURATION_LONG_FROM})`
            : Prisma.sql`FALSE`
    case 'sillage':
      return value === 'suave'
        ? Prisma.sql`(${VALID_SILLAGE} AND p.sillage < ${SILLAGE_SOFT_BELOW})`
        : value === 'moderada'
          ? Prisma.sql`(${VALID_SILLAGE} AND p.sillage >= ${SILLAGE_SOFT_BELOW} AND p.sillage < ${SILLAGE_STRONG_FROM})`
          : value === 'fuerte'
            ? Prisma.sql`(${VALID_SILLAGE} AND p.sillage >= ${SILLAGE_STRONG_FROM})`
            : Prisma.sql`FALSE`
  }
}

function familyNames(family: FamilyCode): string[] {
  return [...FAMILY_ACCORDS[family]]
}

/**
 * El perfume p tiene algún acorde de la familia con intensidad suficiente. Se resuelven primero los ids de los acordes
 * (la tabla Accord es chica) y se busca por `accordId`, que tiene índice: más del doble de rápido que unir por nombre.
 */
function familySql(family: FamilyCode): Prisma.Sql {
  return Prisma.sql`p.id IN (
    SELECT pa."perfumeId" FROM "PerfumeAccord" pa
    WHERE pa."accordId" IN (SELECT a.id FROM "Accord" a WHERE lower(btrim(a.name)) = ANY(${familyNames(family)}::text[]))
      AND pa.intensity >= ${ACCORD_PRESENCE_MIN_INTENSITY})`
}

// ---------------------------------------------------------------------------------------------
// Frecuencias del catálogo (enteros). `scopeIds` acota a un conjunto de perfumes: sirve para el test que las compara
// con catalogFamilyCounts / catalogDimensionCounts. Sin `scopeIds`, todo el catálogo publicado.

export type CatalogCounts = { families: FamilyCounts; dimensions: DimensionCounts }

export async function queryCatalogCounts(scopeIds?: readonly string[]): Promise<CatalogCounts> {
  const scope = scopeIds ? Prisma.sql`AND p.id = ANY(${[...scopeIds]}::text[])` : Prisma.empty
  const pairs = FAMILY_ORDER.flatMap((family) => FAMILY_ACCORDS[family].map((name) => [name, family] as const))

  const columns = DIMENSIONS.flatMap((dimension) => [
    Prisma.sql`COUNT(*) FILTER (WHERE ${hasDataSql(dimension)})::int AS ${Prisma.raw(`"with_${dimension}"`)}`,
    Prisma.sql`ARRAY[${Prisma.join(
      DIMENSION_VALUES[dimension].map((value) => Prisma.sql`COUNT(*) FILTER (WHERE ${valueSql(dimension, value)})::int`),
    )}]::int[] AS ${Prisma.raw(`"counts_${dimension}"`)}`,
  ])

  const [familyRows, dimensionRows] = await Promise.all([
    prisma.$queryRaw<Array<{ family: string; n: number }>>`
      WITH fam AS (
        SELECT a.id, f.family
        FROM "Accord" a
        JOIN unnest(${pairs.map((p) => p[0])}::text[], ${pairs.map((p) => p[1])}::text[]) AS f(name, family)
          ON f.name = lower(btrim(a.name))
      )
      SELECT fam.family, COUNT(DISTINCT pa."perfumeId")::int AS n
      FROM fam
      JOIN "PerfumeAccord" pa ON pa."accordId" = fam.id
      JOIN "Perfume" p ON p.id = pa."perfumeId" AND p.status = 'PUBLISHED'
      WHERE pa.intensity >= ${ACCORD_PRESENCE_MIN_INTENSITY} ${scope}
      GROUP BY fam.family`,
    prisma.$queryRaw<Array<Record<string, number | number[]>>>`
      SELECT COUNT(*)::int AS total, ${Prisma.join(columns)}
      FROM "Perfume" p
      WHERE p.status = 'PUBLISHED' ${scope}`,
  ])

  const row = dimensionRows[0]
  const familyCount = new Map(familyRows.map((r) => [r.family, r.n]))
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const values = row[`counts_${dimension}`] as number[]
      return [
        dimension,
        {
          withData: row[`with_${dimension}`] as number,
          counts: Object.fromEntries(DIMENSION_VALUES[dimension].map((value, i) => [value, values[i]])),
        },
      ]
    }),
  ) as DimensionCounts

  return {
    families: {
      total: row.total as number,
      counts: Object.fromEntries(FAMILY_ORDER.map((f) => [f, familyCount.get(f) ?? 0])) as Record<FamilyCode, number>,
    },
    dimensions,
  }
}

export type CatalogShareSet = { families: CatalogShares; dimensions: DimensionShares }

export function sharesFromCounts(counts: CatalogCounts): CatalogShareSet {
  return { families: familySharesFromCounts(counts.families), dimensions: dimensionSharesFromCounts(counts.dimensions) }
}

// Cambian solo al importar o publicar: caché en memoria detrás de la compartida entre instancias.
let sqlRan = false
const loadCatalogCounts = sharedCache(async () => {
  sqlRan = true
  return queryCatalogCounts()
}, 'gaps-catalog-counts')
const catalogCountsCache = createTtlCache<CatalogCounts>({ ttlMs: CATALOG_TTL_MS })

/** De dónde salieron las frecuencias: memoria de la instancia, caché compartida o la base (el caso lento). */
export type CatalogSource = 'memory' | 'shared' | 'database'

/** Frecuencias del catálogo con el origen y el tiempo, para medirlas (frío vs caché) en los logs de la plataforma. */
export async function getCatalogSharesTimed(): Promise<{ shares: CatalogShareSet; source: CatalogSource; ms: number }> {
  const started = Date.now()
  let memoryMiss = false
  sqlRan = false
  const counts = await catalogCountsCache.getOrCompute('all', () => {
    memoryMiss = true
    return loadCatalogCounts()
  })
  const source: CatalogSource = !memoryMiss ? 'memory' : sqlRan ? 'database' : 'shared'
  return { shares: sharesFromCounts(counts), source, ms: Date.now() - started }
}

export async function getCatalogShares(): Promise<CatalogShareSet> {
  return (await getCatalogSharesTimed()).shares
}

// ---------------------------------------------------------------------------------------------
// Candidatos

function needSql(need: Need): Prisma.Sql {
  return need.kind === 'family' ? familySql(need.family) : valueSql(need.dimension, need.value)
}

type CandidateRow = {
  id: string
  brand: string
  name: string
  gender: string
  imageUrl: string | null
  seasons: string[]
  occasions: string[]
  longevity: number | null
  sillage: number | null
  ratingCount: number | null
  collectionStatus: CollectionStatus | null
  accord: string | null
  intensity: number | null
}

export type CandidateMeta = { brand: string; name: string; gender: string; imageUrl: string | null }

/**
 * Candidatos para las necesidades: por cada una, los POOL_PER_NEED perfumes publicados más valorados que la cubren,
 * sin lo que la persona tiene, probó o descartó (se excluye en SQL, sin depender del tope de la colección leída).
 * Los de la lista de deseados vienen con su estado. Una sola consulta, que también trae marca, nombre e imagen para
 * no pedirlos aparte. `maxRatingCount` normaliza la popularidad (viene de getAccordStats). `gender` filtra por género
 * (el unisex entra con masculino y con femenino).
 */
export async function getCandidates(
  userId: string,
  needs: readonly Need[],
  maxRatingCount: number,
  gender: GenderFilter = 'todos',
): Promise<{ candidates: RankCandidate[]; meta: Map<string, CandidateMeta> }> {
  if (needs.length === 0) return { candidates: [], meta: new Map() }
  const excluded = [...EXCLUDED_FROM_SUGGESTIONS]
  const genders = allowedGenders(gender)
  const genderClause = genders ? Prisma.sql`AND p.gender = ANY(${genders}::text[])` : Prisma.empty

  const pools = needs.map(
    (need) => Prisma.sql`(
      SELECT p.id FROM "Perfume" p
      WHERE p.status = 'PUBLISHED' AND ${needSql(need)} ${genderClause}
        AND NOT EXISTS (
          SELECT 1 FROM "UserCollection" x
          WHERE x."userId" = ${userId} AND x."perfumeId" = p.id AND x.status::text = ANY(${excluded}::text[]))
      ORDER BY p."ratingCount" DESC NULLS LAST, p.id
      LIMIT ${POOL_PER_NEED})`,
  )

  const rows = await prisma.$queryRaw<CandidateRow[]>`
    WITH pool AS (${Prisma.join(pools, ' UNION ')})
    SELECT p.id, p.brand, p.name, p.gender, p."imageUrl", p.seasons, p.occasions, p.longevity, p.sillage, p."ratingCount",
           uc.status::text AS "collectionStatus", a.name AS accord, pa.intensity::int AS intensity
    FROM pool
    JOIN "Perfume" p ON p.id = pool.id
    LEFT JOIN "UserCollection" uc ON uc."perfumeId" = p.id AND uc."userId" = ${userId}
    LEFT JOIN "PerfumeAccord" pa ON pa."perfumeId" = p.id
    LEFT JOIN "Accord" a ON a.id = pa."accordId"`

  const popularityOf = (count: number | null) =>
    maxRatingCount > 0 ? Math.log(1 + (count ?? 0)) / Math.log(1 + maxRatingCount) : 0
  const byId = new Map<string, RankCandidate>()
  const meta = new Map<string, CandidateMeta>()
  for (const row of rows) {
    let candidate = byId.get(row.id)
    if (!candidate) {
      candidate = {
        perfumeId: row.id,
        brand: row.brand,
        accords: [],
        seasons: row.seasons,
        occasions: row.occasions,
        longevity: row.longevity,
        sillage: row.sillage,
        collectionStatus: row.collectionStatus,
        popularity: popularityOf(row.ratingCount),
      }
      byId.set(row.id, candidate)
      meta.set(row.id, { brand: row.brand, name: row.name, gender: row.gender, imageUrl: row.imageUrl })
    }
    if (row.accord !== null && row.intensity !== null) candidate.accords.push({ name: row.accord, intensity: row.intensity })
  }
  return { candidates: [...byId.values()], meta }
}

// ---------------------------------------------------------------------------------------------
// Flujo completo

export type SuggestionView = Suggestion & CandidateMeta

export type GapAnalysis = {
  families: FamilyReport
  dimensions: DimensionsReport
  needs: Need[]
  suggestions: SuggestionView[]
  /** false si hay menos sugerencias que MIN_CANDIDATES. */
  complete: boolean
  /** Género aplicado a las sugerencias, el deducido de la colección y si lo eligió la persona. */
  gender: GenderState
}

/**
 * Análisis completo. La colección, las estadísticas de acordes y las frecuencias del catálogo se piden a la vez (cada
 * ida y vuelta a la base cuesta ~250 ms desde acá); los candidatos, una sola consulta después. Sin caché propia: las
 * frecuencias llegan por parámetro, así el script de vista previa puede pasar las suyas.
 */
export type GapOptions = { gender?: GenderFilter }

export async function buildGapAnalysis(
  userId: string,
  shares: Promise<CatalogShareSet> | CatalogShareSet,
  options: GapOptions = {},
): Promise<GapAnalysis> {
  const [samples, stats, catalogShares] = await Promise.all([getCollectionSamples(userId), getAccordStats(), shares])
  const families = analyzeFamilies(samples, catalogShares.families)
  const dimensions = analyzeDimensions(samples, catalogShares.dimensions)
  const needs = buildNeeds(families, dimensions)
  const gender = resolveGender(inferGender(samples), options.gender)
  if (needs.length === 0) return { families, dimensions, needs, suggestions: [], complete: false, gender }

  const { candidates, meta } = await getCandidates(userId, needs, stats.maxRatingCount, gender.applied)
  const ranked = rankSuggestions(needs, candidates, buildIdf(stats.dfByName, stats.total))
  const suggestions = ranked.suggestions.flatMap((s) => {
    const row = meta.get(s.perfumeId)
    return row ? [{ ...s, ...row }] : []
  })
  return { families, dimensions, needs, suggestions, complete: ranked.complete, gender }
}

export type GapAnalysisTimed = GapAnalysis & { timing: { catalogSource: CatalogSource; catalogMs: number; totalMs: number } }

export async function getGapAnalysis(userId: string, options: GapOptions = {}): Promise<GapAnalysisTimed> {
  const started = Date.now()
  const timed = getCatalogSharesTimed()
  const analysis = await buildGapAnalysis(
    userId,
    timed.then((t) => t.shares),
    options,
  )
  const { source, ms } = await timed
  return { ...analysis, timing: { catalogSource: source, catalogMs: ms, totalMs: Date.now() - started } }
}
