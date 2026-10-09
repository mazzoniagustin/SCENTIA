// Preguntas del quiz de perfil olfativo y su mapeo a pesos por acorde.
// Los nombres de acorde deben coincidir con `Accord.name` (84 términos en español);
// quiz.test.ts verifica que todos existan. Si cambia el mapeo, subir QUIZ_VERSION.

export const QUIZ_VERSION = 1

/** Pesos 0-100 por nombre de acorde (misma escala que PerfumeAccord.intensity). */
export type AccordWeights = Readonly<Record<string, number>>

export type QuizOption = {
  id: string
  label: string
  /** Acordes que esta opción suma al perfil. */
  weights?: AccordWeights
  /** Acordes que esta opción agrega a la lista de rechazos. */
  avoid?: ReadonlyArray<string>
}

export type QuizQuestion = {
  id: QuestionId
  label: string
  kind: 'single' | 'multi'
  options: ReadonlyArray<QuizOption>
}

export type QuestionId = 'ambiente' | 'estacion' | 'ocasion' | 'dulzor' | 'estilo' | 'familias' | 'evitar'

/** Respuestas: una opción por pregunta 'single', una lista (posiblemente vacía) por 'multi'. */
export type QuizAnswers = {
  ambiente: string
  estacion: string
  ocasion: string
  dulzor: string
  estilo: string
  familias: string[]
  evitar: string[]
}

export const QUESTIONS: ReadonlyArray<QuizQuestion> = [
  {
    id: 'ambiente',
    label: '¿Qué ambiente te atrae más?',
    kind: 'single',
    options: [
      { id: 'bosque', label: 'Un bosque después de la lluvia', weights: { terroso: 60, musgoso: 50, verde: 50, amaderado: 40 } },
      { id: 'mar', label: 'El mar', weights: { marino: 70, acuático: 60, salado: 40, cítrico: 30 } },
      { id: 'jardin', label: 'Un jardín en flor', weights: { floral: 60, 'floral blanco': 50, rosa: 40, verde: 20 } },
      { id: 'postre', label: 'Una pastelería', weights: { dulce: 60, vainilla: 60, caramelo: 40 } },
      { id: 'noche', label: 'Una noche en la ciudad', weights: { ámbar: 50, cuero: 50, ahumado: 40, 'especiado cálido': 40, oud: 30 } },
    ],
  },
  {
    id: 'estacion',
    label: '¿En qué estación lo usarías más?',
    kind: 'single',
    options: [
      { id: 'verano', label: 'Verano', weights: { cítrico: 50, fresco: 50, tropical: 30 } },
      { id: 'invierno', label: 'Invierno', weights: { 'especiado cálido': 50, ámbar: 50, vainilla: 40 } },
      { id: 'entretiempo', label: 'Primavera u otoño', weights: { floral: 40, aromático: 30, empolvado: 30 } },
    ],
  },
  {
    id: 'ocasion',
    label: '¿Para qué ocasión principal?',
    kind: 'single',
    options: [
      { id: 'diario', label: 'Uso diario o trabajo', weights: { fresco: 40, aromático: 30, almizclado: 30 } },
      { id: 'cita', label: 'Una cita o salida de noche', weights: { dulce: 40, vainilla: 40, ámbar: 40 } },
      { id: 'formal', label: 'Un evento formal', weights: { empolvado: 40, iris: 30, 'floral blanco': 40 } },
      { id: 'deporte', label: 'Deporte o actividad al aire libre', weights: { acuático: 40, ozónico: 30, cítrico: 40 } },
    ],
  },
  {
    id: 'dulzor',
    label: '¿Cuánto dulzor te gusta?',
    kind: 'single',
    options: [
      { id: 'nada', label: 'Nada dulce', avoid: ['dulce'] },
      { id: 'algo', label: 'Un toque', weights: { dulce: 20 } },
      { id: 'mucho', label: 'Bastante', weights: { dulce: 60, vainilla: 40, caramelo: 30 } },
    ],
  },
  {
    id: 'estilo',
    label: '¿Qué estilo preferís?',
    kind: 'single',
    options: [
      { id: 'suave', label: 'Suave y limpio', weights: { almizclado: 50, empolvado: 40, fresco: 40 } },
      { id: 'notorio', label: 'Notorio, con presencia', weights: { ámbar: 50, 'especiado cálido': 50, oud: 30, cuero: 30 } },
    ],
  },
  {
    id: 'familias',
    label: '¿Qué familias te gustan?',
    kind: 'multi',
    options: [
      { id: 'floral', label: 'Florales', weights: { floral: 40, 'floral blanco': 20 } },
      { id: 'amaderado', label: 'Amaderadas', weights: { amaderado: 50 } },
      { id: 'citrico', label: 'Cítricas', weights: { cítrico: 50 } },
      { id: 'ambarino', label: 'Ambarinas y especiadas', weights: { ámbar: 40, 'especiado cálido': 40 } },
      { id: 'aromatico', label: 'Aromáticas y lavanda', weights: { aromático: 40, lavanda: 40 } },
    ],
  },
  {
    id: 'evitar',
    label: '¿Qué querés evitar?',
    kind: 'multi',
    options: [
      { id: 'dulce', label: 'Lo dulce', avoid: ['dulce'] },
      { id: 'animalico', label: 'Lo animálico', avoid: ['animalicio'] },
      { id: 'ahumado', label: 'Lo ahumado', avoid: ['ahumado'] },
      { id: 'empolvado', label: 'Lo empolvado', avoid: ['empolvado'] },
      { id: 'oud', label: 'El oud', avoid: ['oud'] },
      { id: 'cuero', label: 'El cuero', avoid: ['cuero'] },
      { id: 'pachuli', label: 'El pachulí', avoid: ['pachuli'] },
    ],
  },
]

/** Nombres de acorde referenciados por el mapeo (para validarlos contra el catálogo). */
export function referencedAccordNames(): string[] {
  const names = new Set<string>()
  for (const question of QUESTIONS) {
    for (const option of question.options) {
      Object.keys(option.weights ?? {}).forEach((name) => names.add(name))
      option.avoid?.forEach((name) => names.add(name))
    }
  }
  return [...names]
}
