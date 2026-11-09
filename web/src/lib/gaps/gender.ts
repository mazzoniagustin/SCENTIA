// Género de las sugerencias. El análisis de huecos no miraba el género, y como el catálogo tiene más del doble de perfumes
// femeninos que masculinos, a una colección masculina le sugería perfumes de mujer. Pura: sin base ni red.
//
//   - Se DEDUCE de la colección usable (OWNED/SAMPLED): si casi todo lo que tiene es de un género (contando el unisex a favor de
//     ambos), se filtra por ese género; si no, no se filtra.
//   - La persona lo puede cambiar con un selector; lo elegido manda sobre lo deducido.
//   - "unisex" nunca se excluye de masculino ni de femenino: va con los dos.

import type { CollectionSample } from './types.ts'

export const GENDER_FILTERS = ['masculino', 'unisex', 'femenino', 'todos'] as const
export type GenderFilter = (typeof GENDER_FILTERS)[number]

/** Parte de la colección (con su unisex) que tiene que ser de un género para deducirlo. */
export const GENDER_DOMINANCE_SHARE = 0.75

export const GENDER_LABELS: Readonly<Record<GenderFilter, string>> = {
  masculino: 'Masculino',
  unisex: 'Unisex',
  femenino: 'Femenino',
  todos: 'Todos',
}

const USABLE = new Set(['OWNED', 'DECANT', 'SAMPLED'])

/**
 * Género deducido de la colección. 'todos' si hay pocos datos, si está repartida o si es toda unisex. Con ambos géneros
 * por encima del umbral (mucho unisex y uno de cada uno) tampoco se elige: 'todos'.
 */
export function inferGender(samples: readonly Pick<CollectionSample, 'status' | 'gender'>[]): GenderFilter {
  const counts = { masculino: 0, femenino: 0, unisex: 0 }
  for (const s of samples) {
    if (!USABLE.has(s.status)) continue
    if (s.gender === 'masculino' || s.gender === 'femenino' || s.gender === 'unisex') counts[s.gender] += 1
  }
  const total = counts.masculino + counts.femenino + counts.unisex
  if (total === 0) return 'todos'
  const masculine = counts.masculino > 0 && (counts.masculino + counts.unisex) / total >= GENDER_DOMINANCE_SHARE
  const feminine = counts.femenino > 0 && (counts.femenino + counts.unisex) / total >= GENDER_DOMINANCE_SHARE
  if (masculine && !feminine) return 'masculino'
  if (feminine && !masculine) return 'femenino'
  return 'todos'
}

/** Géneros del catálogo que entran con este filtro; null = sin filtro. */
export function allowedGenders(filter: GenderFilter): string[] | null {
  switch (filter) {
    case 'masculino':
      return ['masculino', 'unisex']
    case 'femenino':
      return ['femenino', 'unisex']
    case 'unisex':
      return ['unisex']
    case 'todos':
      return null
  }
}

/** Lo que manda el navegador: undefined si no eligió, el filtro si es válido, 'invalid' si no. Nada más se acepta. */
export function parseGenderChoice(body: unknown): GenderFilter | undefined | 'invalid' {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return body === undefined || body === null ? undefined : 'invalid'
  const value = (body as Record<string, unknown>).gender
  if (value === undefined) return undefined
  return typeof value === 'string' && (GENDER_FILTERS as readonly string[]).includes(value) ? (value as GenderFilter) : 'invalid'
}

export type GenderState = {
  /** El que se aplicó a las sugerencias. */
  applied: GenderFilter
  /** El que se dedujo de la colección (para mostrar "elegimos X porque…"). */
  inferred: GenderFilter
  /** true si la persona lo eligió; false si es el deducido. */
  chosen: boolean
}

export function resolveGender(inferred: GenderFilter, choice: GenderFilter | undefined): GenderState {
  return { applied: choice ?? inferred, inferred, chosen: choice !== undefined }
}
