// Interpreta una fila del dataset "fragrantica-perfumes" de Kaggle (ledecanteur, CC BY-NC-SA 4.0): acordes y notas con
// peso, votos de estaciones y de día/noche, duración y estela. Lógica pura (sin base de datos) para poder probarla.
// Las listas ponderadas vienen como "nombre:peso|nombre:peso".

import { inferSeasons, type Season } from '../seasons.ts'

export type RawRow = Record<string, string>
export type NoteType = 'top' | 'heart' | 'base' | 'flat'

export type Prepared = {
  sourceId: string
  brand: string
  name: string
  gender: 'femenino' | 'masculino' | 'unisex'
  releaseYear: number | null
  perfumer: string | null
  ratingValue: number | null
  ratingCount: number | null
  longevity: number | null
  sillage: number | null
  /** Estela redondeada a 1-4 (la columna `projection`). */
  projection: number | null
  /** null = pocos votos: no se pisa lo que ya hubiera. */
  seasons: Season[] | null
  occasions: string[] | null
  people: number
  accords: Array<{ name: string; intensity: number }>
  notes: Array<{ name: string; type: NoteType; weight: number }>
  stats: Stats | null
}

export type Stats = {
  people: number
  have: number
  had: number
  want: number
  priceValue: number | null
  histograms: { rating: number[]; longevity: number[]; sillage: number[]; priceValue: number[] }
  communityGender: { female: number; femaleLeaning: number; unisex: number; maleLeaning: number; male: number }
  seasons: { winter: number; spring: number; summer: number; autumn: number }
  daypart: { day: number; night: number }
}

/** Votos mínimos para fiarse de las estaciones y de día/noche. */
export const MIN_VOTES = 10
/** Una estación entra si tiene al menos esta fracción de los votos de la más votada. */
const SEASON_SHARE = 0.8
/** Día/noche: se marca solo uno si supera esta fracción; si no, ambos. */
const DAYPART_SHARE = 0.65

const num = (value: string | undefined): number | null => {
  const t = (value ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const int = (value: string | undefined) => num(value) ?? 0
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** "citrus:100|fresh spicy:47" → [{name, weight}]. Descarta partes mal formadas y repetidas. */
export function parseWeighted(text: string | undefined): Array<{ name: string; weight: number }> {
  const seen = new Set<string>()
  const out: Array<{ name: string; weight: number }> = []
  for (const part of (text ?? '').split('|')) {
    const i = part.lastIndexOf(':')
    if (i <= 0) continue
    const name = part.slice(0, i).trim()
    const weight = Number(part.slice(i + 1))
    if (!name || !Number.isFinite(weight) || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({ name, weight: Math.max(0, Math.min(100, Math.round(weight))) })
  }
  return out
}

const SEASON_NAMES: Record<keyof Stats['seasons'], Season> = {
  winter: 'invierno', spring: 'primavera', summer: 'verano', autumn: 'otoño',
}
const SEASON_ORDER: Season[] = ['primavera', 'verano', 'otoño', 'invierno']

export function seasonsFromVotes(votes: Stats['seasons']): Season[] | null {
  const total = sum(Object.values(votes))
  if (total < MIN_VOTES) return null
  const top = Math.max(...Object.values(votes))
  const picked = (Object.keys(votes) as Array<keyof Stats['seasons']>)
    .filter((k) => votes[k] >= top * SEASON_SHARE)
    .map((k) => SEASON_NAMES[k])
  return SEASON_ORDER.filter((s) => picked.includes(s))
}

export function occasionsFromDaypart(daypart: Stats['daypart']): string[] | null {
  const total = daypart.day + daypart.night
  if (total < MIN_VOTES) return null
  if (daypart.day / total >= DAYPART_SHARE) return ['diario']
  if (daypart.night / total >= DAYPART_SHARE) return ['noche']
  return ['diario', 'noche']
}

const GENDERS: Record<string, Prepared['gender']> = { female: 'femenino', male: 'masculino', unisex: 'unisex' }

export function prepareRow(row: RawRow, translations: Record<string, string>): Prepared | null {
  const sourceId = (row.id ?? '').trim()
  const brand = (row.brand ?? '').trim()
  const name = (row.name ?? '').trim()
  if (!/^\d+$/.test(sourceId) || !brand || !name) return null

  // Acordes: dos nombres en inglés pueden traducirse igual; se conserva el de mayor intensidad (el primero).
  const accordSeen = new Set<string>()
  const accords: Prepared['accords'] = []
  for (const { name: eng, weight } of parseWeighted(row.accords)) {
    const es = translations[eng.toLowerCase()] ?? eng.toLowerCase()
    if (accordSeen.has(es)) continue
    accordSeen.add(es)
    accords.push({ name: es, intensity: weight })
  }

  // Notas: el nombre en minúscula (igual que las ya importadas); una misma nota puede estar en dos pisos.
  const notes: Prepared['notes'] = []
  const seen = new Set<string>()
  for (const [col, type] of [['notes_top', 'top'], ['notes_middle', 'heart'], ['notes_base', 'base'], ['notes_flat', 'flat']] as const) {
    for (const { name: n, weight } of parseWeighted(row[col])) {
      const lower = n.toLowerCase()
      if (seen.has(`${lower}|${type}`)) continue
      seen.add(`${lower}|${type}`)
      notes.push({ name: lower, type, weight })
    }
  }

  const hist = (prefix: string, buckets: number) =>
    Array.from({ length: buckets }, (_, i) => int(row[`${prefix}_b${i + 1}`]))
  const histograms = {
    rating: hist('rating', 5), longevity: hist('longevity', 5), sillage: hist('sillage', 4), priceValue: hist('price_value', 5),
  }
  const people = int(row.people)
  const voted = (h: number[], avg: string | undefined) => (sum(h) >= 5 ? num(avg) : null)
  const longevity = voted(histograms.longevity, row.longevity_avg)
  const sillage = voted(histograms.sillage, row.sillage_avg)
  const priceValue = voted(histograms.priceValue, row.price_value_avg)

  const seasonVotes = { winter: int(row.winter), spring: int(row.spring), summer: int(row.summer), autumn: int(row.autumn) }
  const daypart = { day: int(row.day), night: int(row.night) }
  const hasVotes = people > 0

  const year = num(row.year)
  const ratingValue = num(row.rating_avg)
  const ratingCount = num(row.vote_count)
  const perfumer = (row.perfumers ?? '').split('|').map((p) => p.trim()).filter(Boolean).join(', ')

  // Estaciones: por votos si hay suficientes; si no, null (el que importa decide qué hacer: conservar o inferir).
  const seasons = hasVotes ? seasonsFromVotes(seasonVotes) : null

  return {
    sourceId,
    brand,
    name,
    gender: GENDERS[(row.gender ?? '').trim().toLowerCase()] ?? 'unisex',
    releaseYear: year !== null && year >= 1000 && year <= 2100 ? Math.round(year) : null,
    perfumer: perfumer || null,
    ratingValue: ratingValue !== null && ratingValue >= 0 && ratingValue <= 5 ? ratingValue : null,
    ratingCount: ratingCount !== null && ratingCount >= 0 ? Math.round(ratingCount) : null,
    longevity,
    sillage,
    projection: sillage !== null ? Math.max(1, Math.min(4, Math.round(sillage))) : null,
    seasons,
    occasions: hasVotes ? occasionsFromDaypart(daypart) : null,
    people,
    accords,
    notes,
    stats: hasVotes
      ? {
          people,
          have: int(row.have), had: int(row.had), want: int(row.want),
          priceValue,
          histograms,
          communityGender: {
            female: int(row.perceived_female), femaleLeaning: int(row.perceived_female_leaning), unisex: int(row.perceived_unisex),
            maleLeaning: int(row.perceived_male_leaning), male: int(row.perceived_male),
          },
          seasons: seasonVotes,
          daypart,
        }
      : null,
  }
}

/** Estaciones finales: las de los votos; sin votos suficientes, las que ya tenía; y si no había, la heurística por acordes. */
export function finalSeasons(prepared: Prepared, existing: readonly string[] | null | undefined): string[] {
  if (prepared.seasons && prepared.seasons.length > 0) return prepared.seasons
  if (existing && existing.length > 0) return [...existing]
  return inferSeasons(prepared.accords)
}
