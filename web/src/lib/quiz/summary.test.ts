import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { QUESTIONS, type QuizAnswers } from './questions.ts'
import { QUESTION_TITLES, summarizeAnswers } from './summary.ts'

const answers: QuizAnswers = {
  ambiente: 'jardin',
  estacion: 'verano',
  ocasion: 'cita',
  dulzor: 'algo',
  estilo: 'suave',
  duracion: 'larga',
  estela: 'cualquiera',
  familias: ['citrico', 'floral'],
  evitar: ['oud', 'cuero'],
  favoritos: [],
}

describe('summarizeAnswers', () => {
  it('devuelve una fila por pregunta, en el orden del quiz', () => {
    const summary = summarizeAnswers(answers)
    assert.deepEqual(summary.map((row) => row.id), QUESTIONS.map((q) => q.id))
  })

  it('traduce los ids a las etiquetas de las opciones', () => {
    const byId = Object.fromEntries(summarizeAnswers(answers).map((row) => [row.id, row.labels]))
    assert.deepEqual(byId.ambiente, ['Un jardín lleno de flores'])
    assert.deepEqual(byId.estacion, ['Verano'])
    assert.deepEqual(byId.dulzor, ['Un toque'])
  })

  it('en las preguntas múltiples respeta el orden de la pregunta, no el de la respuesta', () => {
    const byId = Object.fromEntries(summarizeAnswers(answers).map((row) => [row.id, row.labels]))
    assert.deepEqual(byId.familias, ['Florales', 'Cítricas']) // se respondió ['citrico', 'floral']
    assert.deepEqual(byId.evitar, ['El oud', 'El cuero'])
  })

  it('una pregunta múltiple sin elecciones queda con la lista vacía', () => {
    const byId = Object.fromEntries(summarizeAnswers({ ...answers, familias: [], evitar: [] }).map((row) => [row.id, row.labels]))
    assert.deepEqual(byId.familias, [])
    assert.deepEqual(byId.evitar, [])
  })

  it('ignora ids de opción desconocidos sin lanzar', () => {
    const byId = Object.fromEntries(summarizeAnswers({ ...answers, ambiente: 'no-existe', familias: ['citrico', 'zzz'] }).map((row) => [row.id, row.labels]))
    assert.deepEqual(byId.ambiente, [])
    assert.deepEqual(byId.familias, ['Cítricas'])
  })

  it('todas las preguntas tienen un título corto', () => {
    for (const question of QUESTIONS) assert.ok(QUESTION_TITLES[question.id], `falta el título de ${question.id}`)
  })
})
