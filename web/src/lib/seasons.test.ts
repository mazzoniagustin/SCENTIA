import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCORD_TRANSLATIONS } from '../../scripts/accord-translations.ts'
import { ACCORD_SEASONS, inferSeasons, seasonScores, SEASONS } from './seasons.ts'

const acc = (name: string, intensity = 100) => ({ name, intensity })

describe('mapeo de afinidades', () => {
  it('todos los acordes mapeados existen en el catálogo de 84 acordes', () => {
    const catalog = new Set(Object.values(ACCORD_TRANSLATIONS))
    assert.deepEqual(Object.keys(ACCORD_SEASONS).filter((n) => !catalog.has(n)), [])
  })

  it('las afinidades están entre 0 y 1 y usan solo estaciones válidas', () => {
    for (const [name, affinity] of Object.entries(ACCORD_SEASONS)) {
      for (const [season, value] of Object.entries(affinity)) {
        assert.ok((SEASONS as readonly string[]).includes(season), `${name}: estación ${season}`)
        assert.ok(value! > 0 && value! <= 1, `${name}/${season}`)
      }
    }
  })
})

describe('inferSeasons', () => {
  it('perfume fresco y cítrico → verano', () => {
    assert.deepEqual(inferSeasons([acc('cítrico'), acc('fresco', 80), acc('acuático', 60)]), ['verano'])
  })

  it('perfume dulce, vainilla y ámbar → invierno', () => {
    assert.deepEqual(inferSeasons([acc('vainilla'), acc('ámbar', 80), acc('dulce', 60)]), ['invierno'])
  })

  it('perfume floral y verde → primavera', () => {
    assert.deepEqual(inferSeasons([acc('floral'), acc('verde', 80), acc('rosa', 60)]), ['primavera'])
  })

  it('perfume terroso y especiado → otoño (e invierno si empata)', () => {
    const seasons = inferSeasons([acc('terroso'), acc('musgoso', 80), acc('pachuli', 60)])
    assert.deepEqual(seasons, ['otoño'])
    assert.ok(inferSeasons([acc('especiado cálido'), acc('canela', 80)]).includes('otoño'))
  })

  it('devuelve varias estaciones cuando están parejas, en el orden de SEASONS', () => {
    const seasons = inferSeasons([acc('especiado cálido'), acc('canela', 90)])
    assert.deepEqual(seasons, ['otoño', 'invierno'])
  })

  it('sin acordes, con acordes sin afinidad o con señal débil → []', () => {
    assert.deepEqual(inferSeasons([]), [])
    assert.deepEqual(inferSeasons([acc('metálico'), acc('arena')]), [])
    // Un acorde con afinidad dentro de una masa de acordes neutros diluye el puntaje por debajo del mínimo.
    assert.deepEqual(inferSeasons([acc('cítrico', 10), acc('metálico', 100)]), [])
  })

  it('ignora intensidades no positivas sin producir NaN', () => {
    const scores = seasonScores([acc('cítrico', 0), acc('fresco', -5)])
    assert.ok(SEASONS.every((s) => scores[s] === 0))
  })

  it('es determinista e independiente del orden de los acordes', () => {
    const a = [acc('cítrico'), acc('floral', 70), acc('amaderado', 40)]
    assert.deepEqual(inferSeasons(a), inferSeasons([...a].reverse()))
    assert.ok(seasonScores(a).verano >= 0 && seasonScores(a).verano <= 1)
  })
})
