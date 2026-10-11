// Resumen legible de las respuestas del quiz (para mostrarlas arriba de los resultados).
// Función pura: usa las etiquetas de `QUESTIONS`, así que sigue al mapeo si cambia.

import { QUESTIONS, type QuestionId, type QuizAnswers } from './questions.ts'

/** Título corto de cada pregunta (la etiqueta completa es una pregunta y no entra en un resumen). */
export const QUESTION_TITLES: Readonly<Record<QuestionId, string>> = {
  ambiente: 'Ambiente',
  estacion: 'Estación',
  ocasion: 'Ocasión',
  dulzor: 'Dulzor',
  estilo: 'Estilo',
  familias: 'Familias',
  evitar: 'Evitar',
}

export type AnswerSummary = {
  id: QuestionId
  title: string
  /** Etiquetas de las opciones elegidas, en el orden de la pregunta. Vacío si no eligió ninguna (preguntas múltiples). */
  labels: string[]
}

/** Una fila por pregunta, en el orden del quiz. Un id de opción desconocido se ignora. */
export function summarizeAnswers(answers: QuizAnswers): AnswerSummary[] {
  return QUESTIONS.map((question) => {
    const value = answers[question.id]
    const chosen = new Set(Array.isArray(value) ? value : [value])
    return {
      id: question.id,
      title: QUESTION_TITLES[question.id],
      labels: question.options.filter((option) => chosen.has(option.id)).map((option) => option.label),
    }
  })
}
