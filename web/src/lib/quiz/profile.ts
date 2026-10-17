// Construcción del perfil olfativo a partir de las respuestas del quiz.
// Función pura: sin DB ni red, misma entrada → misma salida.

import { MAX_FAVORITES, QUESTIONS, type QuestionId, type QuizAnswers, type QuizOption } from './questions.ts'

export type OlfactoryProfile = {
  /** Peso 0-100 por nombre de acorde. Solo incluye acordes con peso > 0. */
  weights: Record<string, number>
  /** Acordes rechazados: se excluyen de `weights` y descartan perfumes que los tengan fuertes. */
  avoid: string[]
}

export type ValidationResult = { ok: true; answers: QuizAnswers } | { ok: false; error: string }

const MAX_WEIGHT = 100
/** Cuánto de la intensidad de cada acorde de un perfume favorito pasa al perfil (cada favorito suma, hasta MAX_WEIGHT). */
export const FAVORITE_FACTOR = 0.5
/** Forma válida de un id de perfume del catálogo (cuid): se valida el formato; que exista lo resuelve la consulta. */
const FAVORITE_ID = /^[A-Za-z0-9_-]{1,40}$/

/**
 * Valida un payload desconocido contra las preguntas. Las 'single' son obligatorias
 * y deben ser una opción conocida (salvo las que tienen `defaultOptionId`: si faltan toman ese valor);
 * las 'multi' son listas (puede ser vacía o faltar) de opciones conocidas, sin duplicados.
 * `favoritos` es opcional: hasta MAX_FAVORITES ids de perfume sin duplicados.
 */
export function validateAnswers(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'answers debe ser un objeto' }
  }
  const raw = input as Record<string, unknown>
  const answers: Record<string, string | string[]> = {}

  for (const question of QUESTIONS) {
    const known = new Set(question.options.map((option) => option.id))
    const value = raw[question.id]

    if (question.kind === 'single') {
      if (value === undefined && question.defaultOptionId) {
        answers[question.id] = question.defaultOptionId
        continue
      }
      if (typeof value !== 'string' || !known.has(value)) {
        return { ok: false, error: `${question.id} inválido` }
      }
      answers[question.id] = value
      continue
    }

    if (value === undefined) {
      answers[question.id] = []
      continue
    }
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !known.has(v))) {
      return { ok: false, error: `${question.id} inválido` }
    }
    answers[question.id] = [...new Set(value as string[])]
  }

  const favorites = raw.favoritos
  if (favorites === undefined) {
    answers.favoritos = []
  } else if (
    !Array.isArray(favorites) ||
    favorites.length > MAX_FAVORITES ||
    favorites.some((id) => typeof id !== 'string' || !FAVORITE_ID.test(id))
  ) {
    return { ok: false, error: 'favoritos inválido' }
  } else {
    answers.favoritos = [...new Set(favorites as string[])]
  }

  return { ok: true, answers: answers as unknown as QuizAnswers }
}

function selectedOptions(id: QuestionId, answers: QuizAnswers): QuizOption[] {
  const question = QUESTIONS.find((q) => q.id === id)!
  const chosen = answers[id]
  const ids = Array.isArray(chosen) ? chosen : [chosen]
  return question.options.filter((option) => ids.includes(option.id))
}

/**
 * Suma los pesos de todas las opciones elegidas (acotado a 100) y junta los rechazos.
 * Un rechazo prevalece: el acorde se quita de los pesos aunque otra respuesta lo sume.
 */
export function buildProfile(answers: QuizAnswers): OlfactoryProfile {
  const sums = new Map<string, number>()
  const avoid = new Set<string>()

  for (const question of QUESTIONS) {
    for (const option of selectedOptions(question.id, answers)) {
      for (const [name, weight] of Object.entries(option.weights ?? {})) {
        sums.set(name, (sums.get(name) ?? 0) + weight)
      }
      option.avoid?.forEach((name) => avoid.add(name))
    }
  }

  const weights: Record<string, number> = {}
  for (const [name, sum] of sums) {
    if (!avoid.has(name) && sum > 0) weights[name] = Math.min(MAX_WEIGHT, sum)
  }
  return { weights, avoid: [...avoid].sort() }
}

/**
 * Suma al perfil los acordes de los perfumes favoritos (`FAVORITE_FACTOR` de su intensidad, acotado a 100).
 * Un acorde rechazado nunca entra, igual que en `buildProfile`. Sin favoritos devuelve el mismo perfil.
 */
export function addFavorites(
  profile: OlfactoryProfile,
  favorites: ReadonlyArray<ReadonlyArray<{ name: string; intensity: number }>>,
): OlfactoryProfile {
  if (favorites.length === 0) return profile
  const avoid = new Set(profile.avoid)
  const weights = { ...profile.weights }
  for (const accords of favorites) {
    for (const { name, intensity } of accords) {
      if (avoid.has(name) || !(intensity > 0)) continue
      weights[name] = Math.min(MAX_WEIGHT, (weights[name] ?? 0) + intensity * FAVORITE_FACTOR)
    }
  }
  return { weights, avoid: profile.avoid }
}
