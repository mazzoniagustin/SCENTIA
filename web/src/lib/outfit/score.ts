// Motor de "¿Qué me pongo hoy?": determinista, explicable, sin IA ni aleatoriedad.
//
//   fit      = Σ intensidad · afinidad(acorde, banda) / Σ intensidad       ∈ [0, 1]
//   adjusted = fit · (1 − penalización · cloyingShare)
//   score    = adjusted · peso del estado (OWNED 1, SAMPLED 0.9) · factor de contexto
// El factor de contexto (context.ts, ADR-011) vale 1 sin contexto; con "discreción alta" baja el puntaje de los perfumes invasivos.
// cloyingShare = fracción de la intensidad que aportan los acordes empalagosos.
// DISLIKED se excluye siempre; WISHLIST no se recomienda (no está en la colección usable).

import { contextMultiplier, contextReasons, type OutfitContext } from './context.ts'
import { accordAffinity, HOT_ACCORDS, isCloyingAccord } from './rules.ts'
import type { OutfitCandidate, OutfitPick, OutfitResult, ReasonCode, WeatherProfile } from './types.ts'

/** Penalización por empalagosos con calor y humedad o lluvia. */
export const CLOYING_PENALTY_HOT_HUMID = 0.7
/** Penalización por empalagosos con lluvia o humedad, sin calor. */
export const CLOYING_PENALTY_WET_OR_HUMID = 0.4

export const STATUS_WEIGHTS = { OWNED: 1, SAMPLED: 0.9 } as const

export const MAX_ALTERNATIVES = 2
export const TOP_ACCORDS_COUNT = 3

/** Fracción mínima de acordes frescos para decir que el perfume es liviano con humedad. */
const LIGHT_SHARE_MIN = 0.3
/** Bajo este cloyingShare se considera que el perfume evita lo empalagoso. */
const NOT_CLOYING_BELOW = 0.1
/** Afinidad mínima para citar el motivo de calor o frío. */
const GOOD_FIT_MIN = 0.6

type WearableStatus = keyof typeof STATUS_WEIGHTS
type Scored = { pick: OutfitPick; rating: number | null }

export function cloyingPenalty(profile: WeatherProfile): number {
  const dampness = profile.humid || profile.wet
  if (!dampness) return 0
  return profile.band === 'hot' ? CLOYING_PENALTY_HOT_HUMID : CLOYING_PENALTY_WET_OR_HUMID
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

function wearableStatus(status: string): WearableStatus | null {
  const upper = status.toUpperCase()
  return upper === 'OWNED' || upper === 'SAMPLED' ? upper : null
}

function scoreCandidate(c: OutfitCandidate, status: WearableStatus, profile: WeatherProfile, context: OutfitContext | null): Scored | null {
  const accords = c.accords.filter((a) => a.intensity > 0)
  const total = accords.reduce((sum, a) => sum + a.intensity, 0)
  if (total === 0) return null

  let weighted = 0
  let cloying = 0
  let fresh = 0
  for (const { name, intensity } of accords) {
    weighted += intensity * accordAffinity(name, profile.band)
    if (isCloyingAccord(name)) cloying += intensity
    if (HOT_ACCORDS.has(name)) fresh += intensity
  }
  const fit = weighted / total
  const cloyingShare = cloying / total
  const penalty = cloyingPenalty(profile)
  const score = round6(fit * (1 - penalty * cloyingShare) * STATUS_WEIGHTS[status] * contextMultiplier(accords, c.sillage, context))

  const reasons: ReasonCode[] = []
  if (profile.band === 'hot' && fit >= GOOD_FIT_MIN) reasons.push('fresh_for_heat')
  if (profile.band === 'cold' && fit >= GOOD_FIT_MIN) reasons.push('warm_for_cold')
  if ((profile.humid || profile.wet) && fresh / total >= LIGHT_SHARE_MIN) reasons.push('light_for_humidity')
  if (penalty > 0 && cloyingShare < NOT_CLOYING_BELOW) reasons.push('avoids_cloying')
  reasons.push(...contextReasons(accords, c.sillage, context))
  if (status === 'OWNED') reasons.push('owned')

  const topAccords = [...accords]
    .sort((a, b) => b.intensity - a.intensity || a.name.localeCompare(b.name))
    .slice(0, TOP_ACCORDS_COUNT)
    .map((a) => a.name)

  return {
    rating: c.rating,
    pick: {
      perfumeId: c.perfumeId,
      brand: c.brand,
      name: c.name,
      imageUrl: c.imageUrl,
      slug: c.slug,
      status,
      score,
      topAccords,
      reasons,
    },
  }
}

/** score desc, OWNED antes que SAMPLED, rating desc (null último), perfumeId asc. */
function compare(a: Scored, b: Scored): number {
  if (b.pick.score !== a.pick.score) return b.pick.score - a.pick.score
  if (a.pick.status !== b.pick.status) return a.pick.status === 'OWNED' ? -1 : 1
  if (a.rating !== b.rating) {
    if (a.rating === null) return 1
    if (b.rating === null) return -1
    return b.rating - a.rating
  }
  return a.pick.perfumeId < b.pick.perfumeId ? -1 : a.pick.perfumeId > b.pick.perfumeId ? 1 : 0
}

export function recommendOutfit(candidates: OutfitCandidate[], profile: WeatherProfile, context: OutfitContext | null = null): OutfitResult {
  if (candidates.length === 0) return { status: 'empty_collection' }

  const eligible = candidates.flatMap((c) => {
    const status = wearableStatus(c.status)
    return status ? [{ c, status }] : []
  })
  if (eligible.length === 0) return { status: 'no_wearable' }

  const scored: Scored[] = []
  let skippedWithoutAccords = 0
  for (const { c, status } of eligible) {
    const result = scoreCandidate(c, status, profile, context)
    if (result) scored.push(result)
    else skippedWithoutAccords++
  }
  if (scored.length === 0) return { status: 'no_accords' }

  scored.sort(compare)
  const [first, ...rest] = scored
  return {
    status: 'ok',
    primary: first.pick,
    alternatives: rest.slice(0, MAX_ALTERNATIVES).map((s) => s.pick),
    skippedWithoutAccords,
  }
}
