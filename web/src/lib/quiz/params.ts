// Lectura de las respuestas del quiz desde los parámetros de URL del formulario GET.
// Función pura: el resultado se valida después con `validateAnswers`.

import { QUESTIONS } from './questions.ts'

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
