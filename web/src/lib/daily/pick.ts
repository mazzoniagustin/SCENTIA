import { prisma } from '@/lib/prisma'
import { getUserProfile } from '@/lib/account/data'
import { recommendFromAnswers } from '@/lib/quiz/recommend'
import { dayKey, hemisphereForCountry, pickIndex, seasonFor, type Hemisphere } from './daily'
import type { Season } from '../seasons'

// Perfume del día. Sin sesión (o sin perfil guardado) es el mismo para todas las personas del mismo
// hemisferio: sale de los perfumes de la estación con buena valoración, elegido por un hash de la fecha.
// Con perfil guardado se personaliza dentro de lo que coincide con el quiz, sin lo que ya tenés o descartaste.

/** Calidad mínima para ser "perfume del día": conocido y bien valorado (evalúa ~500-850 por estación). */
const MIN_RATING_COUNT = 1000
const MIN_RATING_VALUE = 3.8
/** Con perfil: se elige entre los mejores N de la estación para esa persona. */
const PERSONALIZED_POOL = 20

export type DailyReason = 'season' | 'matches_profile'

export type DailyPerfume = {
  perfumeId: string
  brand: string
  name: string
  gender: string
  accords: string[]
  season: Season
  hemisphere: Hemisphere
  day: string
  personalized: boolean
  reasons: DailyReason[]
  matchedAccords: string[]
}

// El pick general es igual todo el día: se cachea por (día, estación) para no repetir consultas.
const generalCache = new Map<string, string>()

async function generalPerfumeId(day: string, season: Season): Promise<string | null> {
  const key = `${day}|${season}`
  const cached = generalCache.get(key)
  if (cached) return cached

  const pool = await prisma.perfume.findMany({
    where: {
      status: 'PUBLISHED',
      seasons: { has: season },
      ratingCount: { gte: MIN_RATING_COUNT },
      ratingValue: { gte: MIN_RATING_VALUE },
    },
    select: { id: true },
    orderBy: { id: 'asc' }, // orden estable: el mismo hash cae siempre en el mismo perfume
  })
  const index = pickIndex(key, pool.length)
  if (index < 0) return null

  if (generalCache.size > 50) generalCache.clear() // acotado: solo importan los días en curso
  generalCache.set(key, pool[index].id)
  return pool[index].id
}

export async function getDailyPerfume(options: {
  userId?: string | null
  date?: Date
} = {}): Promise<DailyPerfume | null> {
  const date = options.date ?? new Date()
  const profile = options.userId ? await getUserProfile(options.userId) : null
  const hemisphere = hemisphereForCountry(profile?.preferences.country)
  const season = seasonFor(date, hemisphere)
  const day = dayKey(date)

  let perfumeId: string | null = null
  let matchedAccords: string[] = []
  let personalized = false

  if (options.userId && profile?.answers) {
    const ranked = await recommendFromAnswers(profile.answers, {
      season,
      limit: PERSONALIZED_POOL,
      userId: options.userId,
    })
    const index = pickIndex(`${day}|${season}|${options.userId}`, ranked.length)
    if (index >= 0) {
      perfumeId = ranked[index].perfumeId
      matchedAccords = ranked[index].matchedAccords
      personalized = true
    }
  }
  // Sin perfil, o si ningún perfume de la estación encaja con él: el pick general.
  if (!perfumeId) perfumeId = await generalPerfumeId(day, season)
  if (!perfumeId) return null

  const perfume = await prisma.perfume.findUnique({
    where: { id: perfumeId },
    select: {
      id: true,
      brand: true,
      name: true,
      gender: true,
      accords: { select: { accord: { select: { name: true } } }, orderBy: { intensity: 'desc' }, take: 3 },
    },
  })
  if (!perfume) return null

  return {
    perfumeId: perfume.id,
    brand: perfume.brand,
    name: perfume.name,
    gender: perfume.gender,
    accords: perfume.accords.map((a) => a.accord.name),
    season,
    hemisphere,
    day,
    personalized,
    reasons: personalized ? ['season', 'matches_profile'] : ['season'],
    matchedAccords,
  }
}
