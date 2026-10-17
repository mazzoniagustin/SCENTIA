// Lectura de las respuestas del quiz desde los parámetros de URL del formulario GET.
// Función pura: el resultado se valida después con `validateAnswers`.

import { QUESTIONS, type QuizAnswers } from './questions.ts'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Las preguntas 'single' toman el primer valor; las 'multi' una lista (un valor suelto
 * o repetido en la URL). Un parámetro ausente queda `undefined` y lo resuelve la validación.
 */
export function answersFromSearchParams(params: SearchParams): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const question of QUESTIONS) {
    const value = params[question.id]
    if (value === undefined) continue
    raw[question.id] =
      question.kind === 'multi'
        ? Array.isArray(value) ? value : [value]
        : Array.isArray(value) ? value[0] : value
  }
  const favorites = params.favoritos
  if (favorites !== undefined) raw.favoritos = Array.isArray(favorites) ? favorites : [favorites]
  return raw
}

/** Respuestas desde un FormData (campos repetidos para las 'multi'). Se valida después con `validateAnswers`. */
export function answersFromFormData(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const question of QUESTIONS) {
    const values = formData.getAll(question.id).filter((v): v is string => typeof v === 'string')
    if (values.length === 0) continue
    raw[question.id] = question.kind === 'multi' ? values : values[0]
  }
  const favorites = formData.getAll('favoritos').filter((v): v is string => typeof v === 'string')
  if (favorites.length > 0) raw.favoritos = favorites
  return raw
}

/** Todos los campos de las respuestas como pares nombre/valor (para campos ocultos de formularios). */
export function answersToFields(answers: QuizAnswers): { name: string; value: string }[] {
  return [...answersToSearchParams(answers)].map(([name, value]) => ({ name, value }))
}

/** Inverso de `answersFromSearchParams`: arma el query string de /quiz/resultado. */
export function answersToSearchParams(answers: QuizAnswers, extra: Record<string, string> = {}): URLSearchParams {
  const query = new URLSearchParams()
  for (const question of QUESTIONS) {
    const value = answers[question.id]
    for (const v of Array.isArray(value) ? value : [value]) query.append(question.id, v)
  }
  for (const id of answers.favoritos) query.append('favoritos', id)
  for (const [key, value] of Object.entries(extra)) query.set(key, value)
  return query
}
