import "server-only";

// Recomendaciones del quiz contra la base: IDF cacheado, pre-filtro en SQL y
// puntaje con las funciones puras de scoring.ts. Compartido por el API y la página.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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
/** El conteo de perfumes por acorde cambia solo con importaciones: se cachea. */
const IDF_TTL_MS = 60 * 60 * 1000

export type QuizResult = {
  perfumeId: string
  brand: string
  name: string
  gender: string
  score: number
  matchedAccords: string[]
  reasons: QuizReason[]
}

let idfCache: { at: number; idf: (name: string) => number } | null = null

async function getIdf(): Promise<(name: string) => number> {
  if (idfCache && Date.now() - idfCache.at < IDF_TTL_MS) return idfCache.idf

  const [rows, total] = await Promise.all([
    prisma.$queryRaw<Array<{ name: string; df: number }>>`
      SELECT a.name, COUNT(*)::int AS df
      FROM "PerfumeAccord" pa JOIN "Accord" a ON a.id = pa."accordId"
      GROUP BY a.name`,
    prisma.perfume.count(),
  ])
  const idf = buildIdf(new Map(rows.map((r) => [r.name, r.df])), total)
  idfCache = { at: Date.now(), idf }
  return idf
}

export async function recommendFromAnswers(
  answers: QuizAnswers,
  options: { gender?: QuizGender; limit?: number; userId?: string | null } = {},
): Promise<QuizResult[]> {
  const profile = buildProfile(answers)
  const idf = await getIdf()

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
  const genderClause = options.gender
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Perfume" p WHERE p.id = pa."perfumeId" AND p.gender = ${options.gender})`
    : Prisma.empty

  const [rows, collection] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; intensity: number }>>`
      SELECT pa."perfumeId" AS id, a.name, pa.intensity::int AS intensity
      FROM "PerfumeAccord" pa JOIN "Accord" a ON a.id = pa."accordId"
      WHERE pa."perfumeId" IN (
        SELECT c."perfumeId" FROM "PerfumeAccord" c JOIN "Accord" ca ON ca.id = c."accordId"
        WHERE ca.name = ANY(${topAccords}::text[]) AND c.intensity >= ${PREFILTER_MIN_INTENSITY}
      )
      ${avoidClause}
      ${genderClause}`,
    getUserCollectionEntries(options.userId),
  ])

  const accordsById = new Map<string, Array<{ name: string; intensity: number }>>()
  for (const row of rows) {
    const accords = accordsById.get(row.id) ?? []
    accords.push({ name: row.name, intensity: row.intensity })
    accordsById.set(row.id, accords)
  }
  const candidates: QuizCandidate[] = [...accordsById].map(([id, accords]) => ({ id, accords }))
  const ranked = rankCandidates(profile, candidates, idf, { collection, limit: options.limit })

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
