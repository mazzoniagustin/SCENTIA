import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildWeatherProfile } from './profile.ts'
import { CLOYING_PENALTY_HOT_HUMID, CLOYING_PENALTY_WET_OR_HUMID, recommendOutfit } from './score.ts'
import type { OutfitCandidate, OutfitStatus, WeatherProfile } from './types.ts'

const profile = (over: Partial<Parameters<typeof buildWeatherProfile>[0]> = {}): WeatherProfile =>
  buildWeatherProfile({
    temperatureC: 20, apparentTemperatureC: 20, humidityPct: 50, precipitationMm: 0, weatherCode: 0, isDay: true, ...over,
  })

const HOT = profile({ apparentTemperatureC: 30 })
const COLD = profile({ apparentTemperatureC: 5 })
const MILD = profile()
const HOT_HUMID = profile({ apparentTemperatureC: 30, humidityPct: 85 })
const COLD_RAIN = profile({ apparentTemperatureC: 5, precipitationMm: 2, weatherCode: 61 })

const perfume = (
  id: string,
  accords: Array<[string, number]>,
  over: Partial<OutfitCandidate> = {},
): OutfitCandidate => ({
  perfumeId: id, brand: 'B', name: id, imageUrl: null, slug: null, status: 'OWNED', rating: null,
  accords: accords.map(([name, intensity]) => ({ name, intensity })), ...over,
})

const fresh = perfume('fresh', [['cítrico', 100], ['marino', 80]])
const warm = perfume('warm', [['ámbar', 100], ['canela', 80]])

function ok(r: ReturnType<typeof recommendOutfit>) {
  assert.equal(r.status, 'ok')
  if (r.status !== 'ok') throw new Error('unreachable')
  return r
}

describe('recommendOutfit: clima', () => {
  it('calor → perfume fresco', () => {
    const r = ok(recommendOutfit([warm, fresh], HOT))
    assert.equal(r.primary.perfumeId, 'fresh')
    assert.deepEqual(r.alternatives.map((a) => a.perfumeId), ['warm'])
    assert.ok(r.primary.reasons.includes('fresh_for_heat'))
  })

  it('frío → perfume cálido', () => {
    const r = ok(recommendOutfit([fresh, warm], COLD))
    assert.equal(r.primary.perfumeId, 'warm')
    assert.ok(r.primary.reasons.includes('warm_for_cold'))
  })

  it('lluvia con frío: el cálido gana pero el empalagoso se penaliza (0.4)', () => {
    const sweet = perfume('sweet', [['vainilla', 100]])
    const woody = perfume('woody', [['amaderado', 100]])
    const r = ok(recommendOutfit([sweet, woody], COLD_RAIN))
    assert.equal(sweet.accords.length, 1)
    assert.equal(r.primary.perfumeId, 'woody')
    assert.equal(r.alternatives[0].score, 1 - CLOYING_PENALTY_WET_OR_HUMID)
    assert.ok(r.primary.reasons.includes('avoids_cloying'))
  })

  it('humedad alta con calor: penalización 0.7 a los empalagosos', () => {
    const sweet = perfume('sweet', [['dulce', 100]])
    const r = ok(recommendOutfit([sweet], HOT_HUMID))
    // dulce: afinidad derivada en calor = 0.5 + 0.5·(0 − 0.8) = 0.1
    assert.equal(r.primary.score, Math.round(0.1 * (1 - CLOYING_PENALTY_HOT_HUMID) * 1e6) / 1e6)
  })

  it('humedad sin calor penaliza con 0.4 y sin humedad no penaliza', () => {
    const sweet = perfume('sweet', [['vainilla', 100]])
    const humidMild = ok(recommendOutfit([sweet], profile({ humidityPct: 90 })))
    assert.equal(humidMild.primary.score, 0.5 * (1 - CLOYING_PENALTY_WET_OR_HUMID))
    const dry = ok(recommendOutfit([sweet], MILD))
    assert.equal(dry.primary.score, 0.5)
  })

  it('templado es neutro: gana por estado/desempate, no por acordes', () => {
    const r = ok(recommendOutfit([warm, fresh], MILD))
    assert.equal(r.primary.score, 0.5)
    assert.equal(r.alternatives[0].score, 0.5)
    assert.equal(r.primary.perfumeId, 'fresh') // perfumeId asc
  })

  it('la lluvia con calor también penaliza empalagosos', () => {
    const sweet = perfume('sweet', [['caramelo', 100]])
    const hotRain = profile({ apparentTemperatureC: 30, weatherCode: 61 })
    const dry = ok(recommendOutfit([sweet], HOT)).primary.score
    const wet = ok(recommendOutfit([sweet], hotRain)).primary.score
    assert.ok(wet < dry)
  })

  it('topAccords: 3 de mayor intensidad', () => {
    const p = perfume('p', [['a', 10], ['cítrico', 90], ['marino', 50], ['verde', 70]])
    assert.deepEqual(ok(recommendOutfit([p], HOT)).primary.topAccords, ['cítrico', 'verde', 'marino'])
  })
})

describe('recommendOutfit: estados', () => {
  it('DISLIKED se excluye aunque tenga el mejor puntaje', () => {
    const disliked = perfume('best', [['cítrico', 100]], { status: 'DISLIKED' })
    const r = ok(recommendOutfit([disliked, warm], HOT))
    assert.equal(r.primary.perfumeId, 'warm')
    assert.equal(r.alternatives.length, 0)
  })

  it('OWNED gana a SAMPLED en empate de acordes (SAMPLED pesa 0.9)', () => {
    const s = perfume('a', [['cítrico', 100]], { status: 'SAMPLED' })
    const o = perfume('b', [['cítrico', 100]], { status: 'OWNED' })
    const r = ok(recommendOutfit([s, o], HOT))
    assert.equal(r.primary.perfumeId, 'b')
    assert.equal(r.alternatives[0].score, 0.9)
    assert.ok(r.primary.reasons.includes('owned'))
    assert.ok(!r.alternatives[0].reasons.includes('owned'))
  })

  it('OWNED antes que SAMPLED con el mismo puntaje final', () => {
    const s = perfume('a', [['cítrico', 100]], { status: 'SAMPLED' })
    const o = perfume('b', [['cítrico', 90], ['metálico', 10]], { status: 'OWNED' }) // 0.9·1 + 0.1·0.5 = 0.95
    const o2 = perfume('c', [['cítrico', 100]], { status: 'OWNED' })
    assert.deepEqual(ok(recommendOutfit([s, o, o2], HOT)).alternatives.map((a) => a.perfumeId), ['b', 'a'])
  })

  it('WISHLIST no se recomienda; solo wishlist/disliked → no_wearable', () => {
    const w = perfume('w', [['cítrico', 100]], { status: 'WISHLIST' })
    const d = perfume('d', [['cítrico', 100]], { status: 'DISLIKED' })
    assert.deepEqual(recommendOutfit([w, d], HOT), { status: 'no_wearable' })
    assert.equal(ok(recommendOutfit([w, warm], HOT)).primary.perfumeId, 'warm')
  })

  it('normaliza el estado en minúsculas', () => {
    const o = perfume('o', [['cítrico', 100]], { status: 'owned' as OutfitStatus })
    const d = perfume('d', [['cítrico', 100]], { status: 'disliked' as OutfitStatus })
    const r = ok(recommendOutfit([d, o], HOT))
    assert.equal(r.primary.perfumeId, 'o')
    assert.equal(r.primary.status, 'OWNED')
  })
})

describe('recommendOutfit: bordes', () => {
  it('colección vacía', () => {
    assert.deepEqual(recommendOutfit([], HOT), { status: 'empty_collection' })
  })

  it('perfumes sin acordes se saltan y se cuentan', () => {
    const r = ok(recommendOutfit([perfume('x', []), perfume('y', [['cítrico', 0]]), fresh], HOT))
    assert.equal(r.skippedWithoutAccords, 2)
    assert.equal(r.primary.perfumeId, 'fresh')
  })

  it('todos sin acordes → no_accords', () => {
    assert.deepEqual(recommendOutfit([perfume('x', []), perfume('w', [['cítrico', 1]], { status: 'WISHLIST' })], HOT), {
      status: 'no_accords',
    })
  })

  it('máximo 2 alternativas', () => {
    const many = ['a', 'b', 'c', 'd'].map((id) => perfume(id, [['cítrico', 100]]))
    const r = ok(recommendOutfit(many, HOT))
    assert.equal(r.alternatives.length, 2)
  })
})

describe('recommendOutfit: desempate determinista', () => {
  it('rating desc, null último, luego perfumeId asc', () => {
    const mk = (id: string, rating: number | null) => perfume(id, [['cítrico', 100]], { rating })
    const list = [mk('d', null), mk('c', 4), mk('b', 4.5), mk('a', 4)]
    const r = ok(recommendOutfit(list, HOT))
    assert.deepEqual([r.primary, ...r.alternatives].map((p) => p.perfumeId), ['b', 'a', 'c'])
  })

  it('el resultado no depende del orden de entrada', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => perfume(id, [['cítrico', 100]]))
    const a = recommendOutfit(list, HOT)
    const b = recommendOutfit([...list].reverse(), HOT)
    assert.deepEqual(a, b)
    assert.deepEqual(a, recommendOutfit(list, HOT))
  })

  it('no muta la entrada', () => {
    const list = [warm, fresh]
    const copy = structuredClone(list)
    recommendOutfit(list, HOT)
    assert.deepEqual(list, copy)
  })
})

describe('recommendOutfit: contexto (ADR-011)', () => {
  // Con frío gana el cálido e invasivo; el liviano y discreto es peor para el clima pero apto para un lugar cerrado.
  const invasive = perfume('invasivo', [['oud', 100], ['ámbar', 100]], { sillage: 4 })
  const discreet = perfume('discreto', [['cítrico', 60], ['ámbar', 40]], { sillage: 1.2 })
  const high = { discretion: 'alta', lightness: null, projection: null } as const

  it('sin contexto no cambia nada: gana el mejor para el clima', () => {
    assert.equal(ok(recommendOutfit([discreet, invasive], COLD)).primary.perfumeId, 'invasivo')
    assert.equal(ok(recommendOutfit([discreet, invasive], COLD, null)).primary.perfumeId, 'invasivo')
    assert.deepEqual(ok(recommendOutfit([discreet, invasive], COLD, null)), ok(recommendOutfit([discreet, invasive], COLD)))
  })

  it('discreción alta: el invasivo deja de ser la primera opción y pasa a alternativa', () => {
    const r = ok(recommendOutfit([invasive, discreet], COLD, high))
    assert.equal(r.primary.perfumeId, 'discreto')
    assert.deepEqual(r.alternatives.map((a) => a.perfumeId), ['invasivo'])
    assert.ok(r.primary.reasons.includes('discreet_for_context'))
  })

  it('si todos son invasivos, igual hay recomendación (no se queda sin respuesta)', () => {
    const other = perfume('otro', [['oud', 100], ['vainilla', 100]], { sillage: 4 })
    const r = ok(recommendOutfit([invasive, other], COLD, high))
    assert.ok(['invasivo', 'otro'].includes(r.primary.perfumeId))
  })

  it('sin estela votada se arregla con la densidad de los acordes', () => {
    const denseNoSillage = perfume('denso', [['oud', 100], ['ámbar', 100]], { sillage: null })
    assert.equal(ok(recommendOutfit([denseNoSillage, discreet], COLD, high)).primary.perfumeId, 'discreto')
  })

  it('proyección marcada favorece al invasivo cuando el clima casi empata', () => {
    const strong = { discretion: null, lightness: null, projection: 'marcada' } as const
    assert.equal(ok(recommendOutfit([discreet, invasive], COLD, strong)).primary.perfumeId, 'invasivo')
    assert.ok(ok(recommendOutfit([discreet, invasive], COLD, strong)).primary.reasons.includes('strong_for_context'))
  })

  it('el desempate sigue siendo determinista con contexto y no depende del orden', () => {
    const a = ok(recommendOutfit([invasive, discreet], COLD, high))
    const b = ok(recommendOutfit([discreet, invasive], COLD, high))
    assert.deepEqual(a, b)
  })
})
