import "server-only";

// Recomendaciones del quiz contra la base: IDF cacheado, pre-filtro en SQL y
// puntaje con las funciones puras de scoring.ts. Compartido por el API y la página.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAccordStats } from '@/lib/accord-stats'
import { getUserCollectionEntries } from '@/lib/exclusions'
import { addFavorites, buildProfile } from './profile'
import { preferencesFromAnswers } from './preferences'
import type { QuizAnswers } from './questions'
import type { PreferenceKey } from './preferences'
import { AVOID_THRESHOLD, buildIdf, rankCandidates, type QuizCandidate, type QuizReason } from './scoring'

export const QUIZ_GENDERS = ['femenino', 'masculino', 'unisex'] as const
export type QuizGender = (typeof QUIZ_GENDERS)[number]

/** Cantidad de acordes del perfil (los de mayor peso×rareza) que se usan para pre-filtrar. */
const PREFILTER_ACCORDS = 4
/** Intensidad mínima del acorde en el perfume para entrar al pre-filtro. */
const PREFILTER_MIN_INTENSITY = 40
/**
 * Peso de la popularidad (cantidad de valoraciones) en el puntaje. Evaluado con perfiles reales:
 * con 0,3 la mediana de valoraciones del top-10 sube ~10× sin perder coincidencia de acordes;
 * con 0 el IDF lleva casi siempre a casas poco conocidas.
 */
const POPULARITY_WEIGHT = 0.3
export type QuizResult = {
  perfumeId: string
  brand: string
  name: string
  gender: string
  imageUrl: string | null
  score: number
  matchedAccords: string[]
  matchedPreferences: PreferenceKey[]
  reasons: QuizReason[]
}

export async function recommendFromAnswers(
  answers: QuizAnswers,
  options: { gender?: QuizGender; season?: string; limit?: number; userId?: string | null } = {},
): Promise<QuizResult[]> {
  const [favorites, stats] = await Promise.all([getFavoriteAccords(answers.favoritos), getAccordStats()])
  const profile = addFavorites(buildProfile(answers), favorites.map((f) => f.accords))
  const idf = buildIdf(stats.dfByName, stats.total)

  // Los acordes más característicos del perfil (peso × rareza) acotan los candidatos.
  const topAccords = Object.entries(profile.weights)
    .map(([name, weight]) => [name, weight * idf(name)] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PREFILTER_ACCORDS)
    .map(([name]) => name)
  if (topAccords.length === 0) return []

  // Una sola consulta con los acordes de los candidatos (no el include anidado de Prisma, que
  // hace una ida y vuelta por lote de miles de ids). La marca y el nombre se piden después,
  // solo para el top.
  const avoidClause =
    profile.avoid.length > 0
      ? Prisma.sql`AND NOT EXISTS (
          SELECT 1 FROM "PerfumeAccord" x JOIN "Accord" xa ON xa.id = x."accordId"
          WHERE x."perfumeId" = pa."perfumeId" AND xa.name = ANY(${profile.avoid}::text[]) AND x.intensity >= ${AVOID_THRESHOLD})`
      : Prisma.empty
  // Solo publicados; el género, si se pidió, se resuelve en la misma subconsulta.
  const genderClause = options.gender ? Prisma.sql`AND p.gender = ${options.gender}` : Prisma.empty
  const seasonClause = options.season ? Prisma.sql`AND ${options.season} = ANY(p.seasons)` : Prisma.empty
  const publishedClause = Prisma.sql`AND p.status = 'PUBLISHED' ${genderClause} ${seasonClause}`

  const [rows, collection] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; intensity: number; ratingCount: number | null; seasons: string[]; occasions: string[]; longevity: number | null; sillage: number | null }>>`
      SELECT pa."perfumeId" AS id, a.name, pa.intensity::int AS intensity, p."ratingCount" AS "ratingCount",
             p.seasons, p.occasions, p.longevity, p.sillage
      FROM "PerfumeAccord" pa
      JOIN "Accord" a ON a.id = pa."accordId"
      JOIN "Perfume" p ON p.id = pa."perfumeId"
      WHERE pa."perfumeId" IN (
        SELECT c."perfumeId" FROM "PerfumeAccord" c JOIN "Accord" ca ON ca.id = c."accordId"
        WHERE ca.name = ANY(${topAccords}::text[]) AND c.intensity >= ${PREFILTER_MIN_INTENSITY}
      )
      ${avoidClause}
      ${publishedClause}`,
    getUserCollectionEntries(options.userId),
  ])

  const popularityOf = (count: number | null) =>
    stats.maxRatingCount > 0 ? Math.log(1 + (count ?? 0)) / Math.log(1 + stats.maxRatingCount) : 0
  const byId = new Map<string, Omit<QuizCandidate, 'id'> & { accords: Array<{ name: string; intensity: number }> }>()
  for (const row of rows) {
    const entry = byId.get(row.id) ?? {
      accords: [],
      popularity: popularityOf(row.ratingCount),
      seasons: row.seasons,
      occasions: row.occasions,
      longevity: row.longevity,
      sillage: row.sillage,
    }
    entry.accords.push({ name: row.name, intensity: row.intensity })
    byId.set(row.id, entry)
  }
  const candidates: QuizCandidate[] = [...byId].map(([id, entry]) => ({ id, ...entry }))
  const ranked = rankCandidates(profile, candidates, idf, {
    collection,
    limit: options.limit,
    popularityWeight: POPULARITY_WEIGHT,
    preferences: preferencesFromAnswers(answers),
    excludeIds: favorites.map((f) => f.id),
  })

  const meta = new Map(
    (
      await prisma.perfume.findMany({
        where: { id: { in: ranked.map((rec) => rec.perfumeId) } },
        select: { id: true, brand: true, name: true, gender: true, imageUrl: true },
      })
    ).map((p) => [p.id, p]),
  )

  return ranked.map((rec) => {
    const row = meta.get(rec.perfumeId)!
    return {
      perfumeId: rec.perfumeId,
      brand: row.brand,
      name: row.name,
      gender: row.gender,
      imageUrl: row.imageUrl,
      // Redondeo a 2 decimales en la capa de API; el puntaje interno es pleno.
      score: Math.round(rec.score * 100) / 100,
      matchedAccords: rec.matchedAccords,
      matchedPreferences: rec.matchedPreferences,
      reasons: rec.reasons,
    }
  })
}

/**
 * Acordes de los perfumes favoritos que existen y están publicados (un id inexistente o en borrador se ignora sin error).
 * Una consulta, sin importar cuántos sean (máximo MAX_FAVORITES).
 */
export async function getFavoriteAccords(ids: readonly string[]): Promise<Array<{ id: string; accords: Array<{ name: string; intensity: number }> }>> {
  if (ids.length === 0) return []
  const rows = await prisma.perfume.findMany({
    where: { id: { in: [...ids] }, status: 'PUBLISHED' },
    select: { id: true, accords: { select: { intensity: true, accord: { select: { name: true } } } } },
  })
  return rows.map((row) => ({ id: row.id, accords: row.accords.map((a) => ({ name: a.accord.name, intensity: a.intensity })) }))
}

/** Marca y nombre de los favoritos, en el orden recibido (para mostrarlos). Los que no existen o no están publicados se omiten. */
export async function getFavoriteLabels(ids: readonly string[]): Promise<Array<{ id: string; label: string }>> {
  if (ids.length === 0) return []
  const rows = await prisma.perfume.findMany({
    where: { id: { in: [...ids] }, status: 'PUBLISHED' },
    select: { id: true, brand: true, name: true },
  })
  const byId = new Map(rows.map((r) => [r.id, `${r.brand} — ${r.name}`]))
  return ids.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id)! }))
}
