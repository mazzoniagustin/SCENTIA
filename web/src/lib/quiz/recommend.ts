import "server-only";

// Recomendaciones del quiz contra la base: IDF cacheado, pre-filtro en SQL y
// puntaje con las funciones puras de scoring.ts. Compartido por el API y la página.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAccordStats } from '@/lib/accord-stats'
import { getUserCollectionEntries } from '@/lib/exclusions'
import { buildProfile } from './profile'
import type { QuizAnswers } from './questions'
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
  score: number
  matchedAccords: string[]
  reasons: QuizReason[]
}

export async function recommendFromAnswers(
  answers: QuizAnswers,
  options: { gender?: QuizGender; limit?: number; userId?: string | null } = {},
): Promise<QuizResult[]> {
  const profile = buildProfile(answers)
  const stats = await getAccordStats()
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
  const publishedClause = Prisma.sql`AND p.status = 'PUBLISHED' ${genderClause}`

  const [rows, collection] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; intensity: number; ratingCount: number | null }>>`
      SELECT pa."perfumeId" AS id, a.name, pa.intensity::int AS intensity, p."ratingCount" AS "ratingCount"
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
  const byId = new Map<string, { accords: Array<{ name: string; intensity: number }>; popularity: number }>()
  for (const row of rows) {
    const entry = byId.get(row.id) ?? { accords: [], popularity: popularityOf(row.ratingCount) }
    entry.accords.push({ name: row.name, intensity: row.intensity })
    byId.set(row.id, entry)
  }
  const candidates: QuizCandidate[] = [...byId].map(([id, entry]) => ({ id, ...entry }))
  const ranked = rankCandidates(profile, candidates, idf, {
    collection,
    limit: options.limit,
    popularityWeight: POPULARITY_WEIGHT,
  })

  const meta = new Map(
    (
      await prisma.perfume.findMany({
        where: { id: { in: ranked.map((rec) => rec.perfumeId) } },
        select: { id: true, brand: true, name: true, gender: true },
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
      // Redondeo a 2 decimales en la capa de API; el puntaje interno es pleno.
      score: Math.round(rec.score * 100) / 100,
      matchedAccords: rec.matchedAccords,
      reasons: rec.reasons,
    }
  })
}
