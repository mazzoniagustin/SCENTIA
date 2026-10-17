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
  duracion: 'Duración',
  estela: 'Estela',
  familias: 'Familias',
  evitar: 'Evitar',
}

export type AnswerSummary = {
  id: QuestionId | 'favoritos'
  title: string
  /** Etiquetas de las opciones elegidas, en el orden de la pregunta. Vacío si no eligió ninguna (preguntas múltiples). */
  labels: string[]
}

/**
 * Una fila por pregunta, en el orden del quiz. Un id de opción desconocido se ignora.
 * Si se pasan `favoriteLabels` (marca y nombre de los perfumes favoritos, que salen de la base) se suma una fila al final.
 */
export function summarizeAnswers(answers: QuizAnswers, favoriteLabels: readonly string[] = []): AnswerSummary[] {
  const rows = QUESTIONS.map((question) => {
    const value = answers[question.id]
    const chosen = new Set(Array.isArray(value) ? value : [value])
    return {
      id: question.id,
      title: QUESTION_TITLES[question.id],
      labels: question.options.filter((option) => chosen.has(option.id)).map((option) => option.label),
    }
  })
  return favoriteLabels.length > 0
    ? [...rows, { id: 'favoritos' as const, title: 'Perfumes que amás', labels: [...favoriteLabels] }]
    : rows
}
