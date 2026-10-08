import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCORD_TRANSLATIONS } from '../../../scripts/accord-translations.ts'
import { QUESTIONS, QUIZ_VERSION, referencedAccordNames, type QuizAnswers } from './questions.ts'
import { answersFromSearchParams } from './params.ts'
import { buildProfile, validateAnswers } from './profile.ts'
import {
  AVOID_THRESHOLD,
  buildIdf,
  rankCandidates,
  scoreCandidate,
  type QuizCandidate,
} from './scoring.ts'

function assertClose(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `se esperaba ${expected} (±${epsilon}), se obtuvo ${actual}`,
  )
}

const answers: QuizAnswers = {
  ambiente: 'bosque',
  estacion: 'verano',
  ocasion: 'diario',
  dulzor: 'nada',
  estilo: 'suave',
  familias: ['amaderado', 'citrico'],
  evitar: ['ahumado'],
}

// IDF plano (peso 1 para todos): aísla la lógica de intersección de la rareza.
const flat = () => 1

describe('mapeo de preguntas', () => {
  it('todos los acordes referenciados existen en el catálogo de 84 acordes', () => {
    const catalog = new Set(Object.values(ACCORD_TRANSLATIONS))
    const missing = referencedAccordNames().filter((name) => !catalog.has(name))
    assert.deepEqual(missing, [])
  })

  it('ids de opción únicos por pregunta y pesos entre 1 y 100', () => {
    for (const question of QUESTIONS) {
      const ids = question.options.map((o) => o.id)
      assert.equal(new Set(ids).size, ids.length, `ids repetidos en ${question.id}`)
      for (const option of question.options) {
        for (const weight of Object.values(option.weights ?? {})) {
          assert.ok(weight >= 1 && weight <= 100, `peso fuera de rango en ${question.id}/${option.id}`)
        }
      }
    }
    assert.equal(QUIZ_VERSION, 1)
  })
})

describe('validateAnswers', () => {
  it('acepta respuestas completas y normaliza las multi (sin duplicados)', () => {
    const result = validateAnswers({ ...answers, familias: ['floral', 'floral'] })
    assert.equal(result.ok, true)
    if (result.ok) assert.deepEqual(result.answers.familias, ['floral'])
  })

  it('las multi pueden faltar y quedan vacías', () => {
    const { familias, evitar, ...single } = answers
    void familias
    void evitar
    const result = validateAnswers(single)
    assert.equal(result.ok, true)
    if (result.ok) assert.deepEqual([result.answers.familias, result.answers.evitar], [[], []])
  })

  it('rechaza lo inválido', () => {
    for (const bad of [null, 'x', [], { ...answers, ambiente: 'luna' }, { ...answers, estacion: 3 },
      { ...answers, familias: 'floral' }, { ...answers, evitar: ['nada-conocido'] }]) {
      assert.equal(validateAnswers(bad).ok, false)
    }
    const { ambiente, ...sinAmbiente } = answers
    void ambiente
    assert.equal(validateAnswers(sinAmbiente).ok, false)
  })
})

describe('buildProfile', () => {
  it('suma pesos de varias respuestas y acota a 100', () => {
    const profile = buildProfile({ ...answers, dulzor: 'mucho', evitar: [] })
    // dulce: postre 0 (no elegido) + mucho 60 → 60; amaderado: bosque 40 + familia 50 = 90
    assert.equal(profile.weights['dulce'], 60)
    assert.equal(profile.weights['amaderado'], 90)

    const capped = buildProfile({ ...answers, ambiente: 'bosque', familias: ['amaderado'], evitar: [], estilo: 'notorio' })
    assert.ok(Object.values(capped.weights).every((w) => w <= 100))
  })

  it('un rechazo prevalece sobre un peso positivo del mismo acorde', () => {
    const profile = buildProfile({ ...answers, ambiente: 'noche', evitar: ['ahumado', 'cuero'] })
    assert.equal('ahumado' in profile.weights, false)
    assert.equal('cuero' in profile.weights, false)
    // 'dulce' viene de dulzor: 'nada'; la lista sale ordenada.
    assert.deepEqual(profile.avoid, ['ahumado', 'cuero', 'dulce'])
  })

  it('"nada dulce" agrega dulce a los rechazos', () => {
    assert.ok(buildProfile(answers).avoid.includes('dulce'))
  })

  it('es determinista: misma entrada, mismo perfil', () => {
    assert.deepEqual(buildProfile(answers), buildProfile(structuredClone(answers)))
  })
})

describe('buildIdf', () => {
  it('un acorde raro pesa más que uno común; el omnipresente pesa 0', () => {
    const idf = buildIdf(new Map([['amaderado', 1000], ['oud', 10], ['todos', 2000]]), 2000)
    assert.ok(idf('oud') > idf('amaderado'))
    assertClose(idf('todos'), 0)
    assert.ok(idf('desconocido') >= idf('oud'))
  })

  it('total 0 no produce NaN ni negativos', () => {
    assert.equal(buildIdf(new Map(), 0)('x'), 0)
  })
})

describe('scoreCandidate', () => {
  const profile = { weights: { amaderado: 80, cítrico: 40 }, avoid: ['dulce'] }

  it('coincidencia total → 1; sin solapamiento → 0', () => {
    const full: QuizCandidate = { id: 'a', accords: [{ name: 'amaderado', intensity: 100 }, { name: 'cítrico', intensity: 100 }] }
    assertClose(scoreCandidate(profile, full, flat).score, 1)
    const none: QuizCandidate = { id: 'b', accords: [{ name: 'floral', intensity: 100 }] }
    assert.equal(scoreCandidate(profile, none, flat).score, 0)
  })

  it('toma el mínimo entre peso del perfil e intensidad del perfume', () => {
    const c: QuizCandidate = { id: 'c', accords: [{ name: 'amaderado', intensity: 40 }] }
    // shared = min(80,40) = 40; total = 80 + 40 = 120 → 1/3
    assertClose(scoreCandidate(profile, c, flat).score, 40 / 120)
  })

  it('un acorde rechazado fuerte excluye; uno débil no', () => {
    const strong: QuizCandidate = { id: 'd', accords: [{ name: 'amaderado', intensity: 100 }, { name: 'dulce', intensity: AVOID_THRESHOLD }] }
    const weak: QuizCandidate = { id: 'e', accords: [{ name: 'amaderado', intensity: 100 }, { name: 'dulce', intensity: AVOID_THRESHOLD - 1 }] }
    assert.deepEqual(scoreCandidate(profile, strong, flat), { score: 0, matchedAccords: [], excluded: true })
    assert.ok(scoreCandidate(profile, weak, flat).score > 0)
  })

  it('el IDF hace que coincidir en un acorde raro valga más que en uno común', () => {
    const idf = buildIdf(new Map([['amaderado', 1000], ['oud', 10]]), 2000)
    const p = { weights: { amaderado: 50, oud: 50 }, avoid: [] }
    const common: QuizCandidate = { id: 'f', accords: [{ name: 'amaderado', intensity: 100 }] }
    const rare: QuizCandidate = { id: 'g', accords: [{ name: 'oud', intensity: 100 }] }
    assert.ok(scoreCandidate(p, rare, idf).score > scoreCandidate(p, common, idf).score)
  })

  it('informa hasta 3 acordes coincidentes, de mayor a menor aporte', () => {
    const p = { weights: { a: 90, b: 70, c: 50, d: 30 }, avoid: [] }
    const c: QuizCandidate = { id: 'h', accords: ['a', 'b', 'c', 'd'].map((name) => ({ name, intensity: 100 })) }
    assert.deepEqual(scoreCandidate(p, c, flat).matchedAccords, ['a', 'b', 'c'])
  })

  it('perfil vacío → 0, sin NaN; el puntaje queda en [0, 1]', () => {
    const c: QuizCandidate = { id: 'i', accords: [{ name: 'amaderado', intensity: 100 }] }
    assert.equal(scoreCandidate({ weights: {}, avoid: [] }, c, flat).score, 0)
    const s = scoreCandidate(profile, c, flat).score
    assert.ok(s >= 0 && s <= 1)
  })
})

describe('rankCandidates', () => {
  const profile = { weights: { amaderado: 80 }, avoid: [] as string[] }
  const mk = (id: string, intensity: number): QuizCandidate => ({ id, accords: [{ name: 'amaderado', intensity }] })

  it('ordena por puntaje y desempata por id', () => {
    const ranked = rankCandidates(profile, [mk('z', 80), mk('a', 80), mk('m', 40), mk('x', 0)], flat)
    assert.deepEqual(ranked.map((r) => r.perfumeId), ['a', 'z', 'm'])
  })

  it('respeta el límite', () => {
    assert.equal(rankCandidates(profile, [mk('a', 80), mk('b', 70), mk('c', 60)], flat, { limit: 2 }).length, 2)
  })

  it('excluye OWNED y DISLIKED (mayúscula del enum) pero no WISHLIST', () => {
    const collection = [
      { perfumeId: 'a', status: 'OWNED' },
      { perfumeId: 'b', status: 'DISLIKED' },
      { perfumeId: 'c', status: 'WISHLIST' },
    ]
    const ranked = rankCandidates(profile, [mk('a', 80), mk('b', 80), mk('c', 80)], flat, { collection })
    assert.deepEqual(ranked.map((r) => r.perfumeId), ['c'])
  })

  it('avoids_rejected solo aparece si el usuario marcó rechazos', () => {
    const sinRechazos = rankCandidates(profile, [mk('a', 80)], flat)[0]
    assert.deepEqual(sinRechazos.reasons, ['matched_accords'])
    const conRechazos = rankCandidates({ ...profile, avoid: ['dulce'] }, [mk('a', 80)], flat)[0]
    assert.deepEqual(conRechazos.reasons, ['matched_accords', 'avoids_rejected'])
  })

  it('es determinista', () => {
    const input = [mk('c', 50), mk('a', 50), mk('b', 70)]
    assert.deepEqual(rankCandidates(profile, input, flat), rankCandidates(profile, [...input].reverse(), flat))
  })
})

describe('answersFromSearchParams', () => {
  it('single toma el primer valor y multi acepta un valor suelto o repetido', () => {
    const raw = answersFromSearchParams({
      ambiente: ['mar', 'bosque'], estacion: 'verano', ocasion: 'diario', dulzor: 'algo', estilo: 'suave',
      familias: 'floral', evitar: ['oud', 'cuero'], ruido: 'x',
    })
    assert.deepEqual(raw, {
      ambiente: 'mar', estacion: 'verano', ocasion: 'diario', dulzor: 'algo', estilo: 'suave',
      familias: ['floral'], evitar: ['oud', 'cuero'],
    })
    assert.equal(validateAnswers(raw).ok, true)
  })

  it('los parámetros ausentes se omiten y la validación los rechaza', () => {
    assert.deepEqual(answersFromSearchParams({}), {})
    assert.equal(validateAnswers(answersFromSearchParams({ ambiente: 'mar' })).ok, false)
  })
})
