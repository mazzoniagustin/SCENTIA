import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCORD_TRANSLATIONS } from '../../../scripts/accord-translations.ts'
import {
  finalSeasons, occasionsFromDaypart, parseWeighted, prepareRow, seasonsFromVotes, type RawRow,
} from './kaggle-fragrantica.ts'

const base: RawRow = {
  id: '9828', brand: 'Creed', name: 'Aventus', year: '2010', gender: 'male',
  rating_avg: '4.3232', vote_count: '26895',
  rating_b1: '587', rating_b2: '800', rating_b3: '2000', rating_b4: '8000', rating_b5: '15508',
  longevity_avg: '3.37', longevity_b1: '10', longevity_b2: '20', longevity_b3: '30', longevity_b4: '40', longevity_b5: '50',
  sillage_avg: '2.31', sillage_b1: '10', sillage_b2: '20', sillage_b3: '30', sillage_b4: '40',
  price_value_avg: '1.69', price_value_b1: '5', price_value_b2: '5', price_value_b3: '5', price_value_b4: '5', price_value_b5: '5',
  have: '42714', had: '9963', want: '28417',
  perceived_female: '168', perceived_female_leaning: '46', perceived_unisex: '916', perceived_male_leaning: '2884', perceived_male: '8743',
  winter: '5660', spring: '12424', summer: '12708', autumn: '9453', day: '12660', night: '8707', people: '26895',
  accords: 'fruity:100|citrus:80|Champagne:60|woody:40',
  notes_top: 'Bergamot:49|Apple:30', notes_middle: 'Birch:20', notes_base: 'Musk:10|Bergamot:5', notes_flat: '',
  perfumers: 'Erwin Creed|Olivier Creed',
}

describe('parseWeighted', () => {
  it('lee nombre:peso, tolera espacios y descarta lo mal formado y lo repetido', () => {
    assert.deepEqual(parseWeighted('citrus:100|fresh spicy:47|Eustoma |citrus:3|x:abc'), [
      { name: 'citrus', weight: 100 }, { name: 'fresh spicy', weight: 47 },
    ])
    assert.deepEqual(parseWeighted(''), [])
    assert.deepEqual(parseWeighted(undefined), [])
  })
  it('acota el peso a 0-100', () => {
    assert.deepEqual(parseWeighted('a:250|b:-4'), [{ name: 'a', weight: 100 }, { name: 'b', weight: 0 }])
  })
})

describe('estaciones y momento del día por votos', () => {
  it('incluye las estaciones con ≥ 80 % de la más votada, en orden fijo', () => {
    assert.deepEqual(seasonsFromVotes({ winter: 5660, spring: 12424, summer: 12708, autumn: 9453 }), ['primavera', 'verano'])
    assert.deepEqual(seasonsFromVotes({ winter: 100, spring: 90, summer: 10, autumn: 95 }), ['primavera', 'otoño', 'invierno'])
  })
  it('con pocos votos no decide', () => {
    assert.equal(seasonsFromVotes({ winter: 2, spring: 3, summer: 1, autumn: 0 }), null)
    assert.equal(occasionsFromDaypart({ day: 4, night: 3 }), null)
  })
  it('día/noche: uno solo si domina, ambos si está parejo', () => {
    assert.deepEqual(occasionsFromDaypart({ day: 90, night: 10 }), ['diario'])
    assert.deepEqual(occasionsFromDaypart({ day: 10, night: 90 }), ['noche'])
    assert.deepEqual(occasionsFromDaypart({ day: 55, night: 45 }), ['diario', 'noche'])
  })
})

describe('prepareRow', () => {
  const p = prepareRow(base, ACCORD_TRANSLATIONS)!

  it('mapea los datos básicos', () => {
    assert.equal(p.sourceId, '9828')
    assert.equal(p.gender, 'masculino')
    assert.equal(p.releaseYear, 2010)
    assert.equal(p.perfumer, 'Erwin Creed, Olivier Creed')
    assert.equal(p.ratingCount, 26895)
  })
  it('traduce los acordes y conserva la intensidad real', () => {
    assert.deepEqual(p.accords, [
      { name: 'afrutado', intensity: 100 }, { name: 'cítrico', intensity: 80 },
      { name: 'champán', intensity: 60 }, { name: 'amaderado', intensity: 40 },
    ])
  })
  it('notas en minúscula, por piso y con peso; una nota puede estar en dos pisos', () => {
    assert.deepEqual(p.notes.filter((n) => n.name === 'bergamot').map((n) => [n.type, n.weight]), [['top', 49], ['base', 5]])
    assert.equal(p.notes.length, 5)
  })
  it('duración, estela (1-4), estaciones y momento del día', () => {
    assert.equal(p.longevity, 3.37)
    assert.equal(p.sillage, 2.31)
    assert.equal(p.projection, 2)
    assert.deepEqual(p.seasons, ['primavera', 'verano'])
    assert.deepEqual(p.occasions, ['diario', 'noche']) // 59 % de día: no domina
    assert.equal(p.stats?.have, 42714)
    assert.deepEqual(p.stats?.histograms.sillage, [10, 20, 30, 40])
  })
  it('sin votos: no inventa duración, estaciones ni estadísticas', () => {
    const q = prepareRow({ ...base, people: '0', winter: '0', spring: '0', summer: '0', autumn: '0', day: '0', night: '0',
      longevity_b1: '', longevity_b2: '', longevity_b3: '', longevity_b4: '', longevity_b5: '', longevity_avg: '2.5' }, ACCORD_TRANSLATIONS)!
    assert.equal(q.longevity, null)
    assert.equal(q.seasons, null)
    assert.equal(q.occasions, null)
    assert.equal(q.stats, null)
  })
  it('descarta filas sin id numérico, marca o nombre', () => {
    assert.equal(prepareRow({ ...base, id: 'x' }, ACCORD_TRANSLATIONS), null)
    assert.equal(prepareRow({ ...base, brand: ' ' }, ACCORD_TRANSLATIONS), null)
    assert.equal(prepareRow({ ...base, name: '' }, ACCORD_TRANSLATIONS), null)
  })
  it('género o año raros caen a valores seguros', () => {
    const q = prepareRow({ ...base, gender: '', year: '20' }, ACCORD_TRANSLATIONS)!
    assert.equal(q.gender, 'unisex')
    assert.equal(q.releaseYear, null)
  })
})

describe('finalSeasons', () => {
  const p = prepareRow(base, ACCORD_TRANSLATIONS)!
  it('prefiere los votos, luego lo existente, luego la heurística por acordes', () => {
    assert.deepEqual(finalSeasons(p, ['invierno']), ['primavera', 'verano'])
    const sinVotos = { ...p, seasons: null }
    assert.deepEqual(finalSeasons(sinVotos, ['invierno']), ['invierno'])
    assert.ok(finalSeasons(sinVotos, null).length > 0)
  })
})
