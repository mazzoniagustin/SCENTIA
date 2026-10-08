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
  return raw
}

/** Inverso de `answersFromSearchParams`: arma el query string de /quiz/resultado. */
export function answersToSearchParams(answers: QuizAnswers, extra: Record<string, string> = {}): URLSearchParams {
  const query = new URLSearchParams()
  for (const question of QUESTIONS) {
    const value = answers[question.id]
    for (const v of Array.isArray(value) ? value : [value]) query.append(question.id, v)
  }
  for (const [key, value] of Object.entries(extra)) query.set(key, value)
  return query
}
