import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { answersFromFormData, answersFromSearchParams, answersToFields, answersToSearchParams } from './params.ts'
import { addFavorites, buildProfile, FAVORITE_FACTOR, validateAnswers } from './profile.ts'
import { applyPreferences, PREFERENCE_WEIGHT, preferenceMatch, preferencesFromAnswers } from './preferences.ts'
import { MAX_FAVORITES, QUESTIONS, QUIZ_COMPATIBLE_FROM, QUIZ_VERSION, type QuizAnswers } from './questions.ts'
import { buildIdf, rankCandidates, type QuizCandidate } from './scoring.ts'

const base: QuizAnswers = {
  ambiente: 'mar', estacion: 'verano', ocasion: 'diario', dulzor: 'algo', estilo: 'suave',
  duracion: 'cualquiera', estela: 'cualquiera', familias: [], evitar: [], favoritos: [],
}
const flat = () => 1

describe('compatibilidad con las respuestas de la versión 1', () => {
  const v1 = { ambiente: 'mar', estacion: 'verano', ocasion: 'diario', dulzor: 'algo', estilo: 'suave', familias: ['citrico'], evitar: [] }

  it('sin duración, estela ni favoritos son válidas y toman los valores por defecto', () => {
    const result = validateAnswers(v1)
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.answers.duracion, 'cualquiera')
      assert.equal(result.answers.estela, 'cualquiera')
      assert.deepEqual(result.answers.favoritos, [])
    }
  })

  it('la versión 1 sigue siendo legible', () => {
    assert.ok(QUIZ_COMPATIBLE_FROM <= 1 && QUIZ_VERSION >= 2)
  })

  it('una opción nueva inválida se rechaza', () => {
    assert.equal(validateAnswers({ ...v1, duracion: 'eterna' }).ok, false)
    assert.equal(validateAnswers({ ...v1, estela: 3 }).ok, false)
  })

  it('las preguntas nuevas tienen una opción por defecto que existe', () => {
    for (const q of QUESTIONS.filter((q) => q.defaultOptionId)) assert.ok(q.options.some((o) => o.id === q.defaultOptionId), q.id)
  })
})

describe('favoritos: validación', () => {
  const ok = { ...base }
  it('acepta hasta MAX_FAVORITES ids sin duplicados', () => {
    const r = validateAnswers({ ...ok, favoritos: ['abc', 'abc', 'def'] })
    assert.equal(r.ok, true)
    if (r.ok) assert.deepEqual(r.answers.favoritos, ['abc', 'def'])
  })
  it('rechaza más del máximo, no listas y ids con formato raro', () => {
    assert.equal(validateAnswers({ ...ok, favoritos: ['a', 'b', 'c', 'd'] }).ok, false)
    assert.equal(MAX_FAVORITES, 3)
    assert.equal(validateAnswers({ ...ok, favoritos: 'abc' }).ok, false)
    assert.equal(validateAnswers({ ...ok, favoritos: ['a b'] }).ok, false)
    assert.equal(validateAnswers({ ...ok, favoritos: ["x'; DROP TABLE"] }).ok, false)
    assert.equal(validateAnswers({ ...ok, favoritos: [''] }).ok, false)
    assert.equal(validateAnswers({ ...ok, favoritos: [123] }).ok, false)
    assert.equal(validateAnswers({ ...ok, favoritos: ['a'.repeat(41)] }).ok, false)
  })
  it('viajan por la URL y por el formulario', () => {
    const answers = { ...ok, favoritos: ['id1', 'id2'] }
    const query = answersToSearchParams(answers)
    assert.deepEqual(query.getAll('favoritos'), ['id1', 'id2'])
    const params = Object.fromEntries([...new Set(query.keys())].map((k) => [k, query.getAll(k)]))
    const back = validateAnswers(answersFromSearchParams(params))
    assert.ok(back.ok && back.answers.favoritos.join() === 'id1,id2')
    const form = new FormData()
    for (const f of answersToFields(answers)) form.append(f.name, f.value)
    const fromForm = validateAnswers(answersFromFormData(form))
    assert.ok(fromForm.ok && fromForm.answers.favoritos.join() === 'id1,id2')
  })
})

describe('addFavorites', () => {
  const profile = buildProfile({ ...base, dulzor: 'nada', evitar: ['oud'] })
  it('suma el factor de la intensidad y acota a 100', () => {
    const p = addFavorites({ weights: { floral: 80 }, avoid: [] }, [[{ name: 'floral', intensity: 100 }, { name: 'rosa', intensity: 50 }], [{ name: 'floral', intensity: 100 }]])
    assert.equal(p.weights.floral, 100)
    assert.equal(p.weights.rosa, 50 * FAVORITE_FACTOR)
  })
  it('un acorde rechazado nunca entra, ni una intensidad inválida', () => {
    const p = addFavorites(profile, [[{ name: 'oud', intensity: 100 }, { name: 'dulce', intensity: 100 }, { name: 'cuero', intensity: NaN }, { name: 'ámbar', intensity: -5 }]])
    assert.equal(p.weights.oud, undefined)
    assert.equal(p.weights.dulce, undefined)
    assert.equal(p.weights['cuero'], undefined)
    assert.equal(p.weights['ámbar'], undefined)
  })
  it('sin favoritos devuelve el mismo perfil y no modifica el original', () => {
    assert.equal(addFavorites(profile, []), profile)
    const before = JSON.stringify(profile)
    addFavorites(profile, [[{ name: 'marino', intensity: 90 }]])
    assert.equal(JSON.stringify(profile), before)
  })
})

describe('preferencias', () => {
  it('"me da igual" no activa nada y el puntaje no cambia', () => {
    const prefs = preferencesFromAnswers({ estacion: 'desconocida', ocasion: 'formal', duracion: 'cualquiera', estela: 'cualquiera' })
    assert.deepEqual(prefs, { seasons: [], occasion: null, duration: null, sillage: null })
    assert.deepEqual(preferenceMatch(prefs, {}), { average: 1, matched: [], active: 0 })
  })
  it('traduce las respuestas', () => {
    const prefs = preferencesFromAnswers({ estacion: 'entretiempo', ocasion: 'cita', duracion: 'ligera', estela: 'notoria' })
    assert.deepEqual(prefs, { seasons: ['primavera', 'otoño'], occasion: 'noche', duration: 'corta', sillage: 'fuerte' })
  })
  it('coincide, no coincide y sin dato (neutral)', () => {
    const prefs = preferencesFromAnswers({ estacion: 'verano', ocasion: 'diario', duracion: 'larga', estela: 'notoria' })
    assert.deepEqual(preferenceMatch(prefs, { seasons: ['verano'], occasions: ['diario'], longevity: 4, sillage: 3.5 }).average, 1)
    assert.equal(preferenceMatch(prefs, { seasons: ['invierno'], occasions: ['noche'], longevity: 1, sillage: 1 }).average, 0)
    const none = preferenceMatch(prefs, {})
    assert.equal(none.average, 0.5)
    assert.deepEqual(none.matched, [])
    assert.equal(preferenceMatch(prefs, { seasons: ['verano'], longevity: NaN }).matched.join(), 'season')
  })
  it('liviano coincide con duración corta o media; discreto solo con estela suave', () => {
    const prefs = preferencesFromAnswers({ estacion: 'x', ocasion: 'x', duracion: 'ligera', estela: 'discreta' })
    assert.equal(preferenceMatch(prefs, { longevity: 3, sillage: 1.5 }).average, 1)
    assert.equal(preferenceMatch(prefs, { longevity: 3.9, sillage: 2.5 }).average, 0)
  })
  it('el ajuste es suave: como mucho pierde PREFERENCE_WEIGHT del puntaje y nunca sube', () => {
    assert.equal(applyPreferences(0.8, 1), 0.8)
    assert.ok(Math.abs(applyPreferences(0.8, 0) - 0.8 * (1 - PREFERENCE_WEIGHT)) < 1e-12)
    assert.equal(applyPreferences(0.8, 7), 0.8)
    assert.equal(applyPreferences(0.8, -3), applyPreferences(0.8, 0))
  })
})

describe('ranking con preferencias y favoritos', () => {
  const profile = { weights: { floral: 60 }, avoid: [] as string[] }
  const accords = [{ name: 'floral', intensity: 60 }]
  const candidates: QuizCandidate[] = [
    { id: 'a', accords, seasons: ['invierno'], longevity: 1 },
    { id: 'b', accords, seasons: ['verano'], longevity: 4 },
    { id: 'c', accords },
  ]
  const prefs = preferencesFromAnswers({ estacion: 'verano', ocasion: 'x', duracion: 'larga', estela: 'cualquiera' })

  it('premia al que coincide, deja en el medio al que no tiene dato y no descarta a nadie', () => {
    const ranked = rankCandidates(profile, candidates, flat, { preferences: prefs })
    assert.deepEqual(ranked.map((r) => r.perfumeId), ['b', 'c', 'a'])
    assert.deepEqual(ranked[0].matchedPreferences, ['season', 'duration'])
    assert.ok(ranked[0].reasons.includes('matches_preferences'))
    assert.ok(!ranked[2].reasons.includes('matches_preferences'))
  })
  it('sin preferencias el orden y el puntaje no cambian', () => {
    const plain = rankCandidates(profile, candidates, flat, {})
    const neutral = rankCandidates(profile, candidates, flat, { preferences: preferencesFromAnswers({ ...base, estacion: 'x', ocasion: 'formal' }) })
    assert.deepEqual(neutral.map((r) => [r.perfumeId, r.score]), plain.map((r) => [r.perfumeId, r.score]))
    assert.ok(plain.every((r) => r.matchedPreferences.length === 0))
  })
  it('los puntajes siguen en [0, 1]', () => {
    for (const r of rankCandidates(profile, candidates, flat, { preferences: prefs })) assert.ok(r.score >= 0 && r.score <= 1)
  })
  it('excluye los favoritos de las recomendaciones', () => {
    const ranked = rankCandidates(profile, candidates, flat, { excludeIds: ['b'] })
    assert.ok(!ranked.some((r) => r.perfumeId === 'b'))
  })
  it('buildIdf sigue sirviendo con acordes de favoritos desconocidos', () => {
    assert.equal(typeof buildIdf(new Map(), 10)('nuevo'), 'number')
  })
})
