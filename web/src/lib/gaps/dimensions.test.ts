import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { inferSeasons } from '../seasons.ts'
import {
  DIMENSIONS,
  DIMENSION_VALUES,
  DURATION_LONG_FROM,
  DURATION_SHORT_BELOW,
  MAX_MISSING_SHARE,
  SILLAGE_SOFT_BELOW,
  SILLAGE_STRONG_FROM,
  GAP_DIMENSIONS,
  analyzeDimensions,
  catalogDimensionCounts,
  catalogDimensionShares,
  durationBand,
  profileOf,
  sillageBand,
  type Dimension,
  type DimensionShares,
} from './dimensions.ts'
import type { CollectionSample, CollectionStatus } from './types.ts'

// Frecuencias del catálogo de prueba: todo común (0,5) salvo lo que se pise.
const shares = (overrides: Partial<Record<Dimension, Record<string, number>>> = {}): DimensionShares =>
  ({
    ...Object.fromEntries(DIMENSIONS.map((d) => [d, Object.fromEntries(DIMENSION_VALUES[d].map((v) => [v, 0.5]))])),
    ...overrides,
  }) as DimensionShares

type Extra = Partial<Pick<CollectionSample, 'seasons' | 'occasions' | 'longevity' | 'sillage'>>
let seq = 0
const make = (status: CollectionStatus, extra: Extra = {}, accord = 'floral'): CollectionSample => ({
  perfumeId: `d${++seq}`,
  status,
  accords: accord ? [{ name: accord, intensity: 80 }] : [],
  ...extra,
})
const owned = (extra: Extra = {}) => make('OWNED', extra)
const dim = (report: ReturnType<typeof analyzeDimensions>, d: Dimension) => report.dimensions.find((x) => x.dimension === d)!
const levelOf = (report: ReturnType<typeof analyzeDimensions>, d: Dimension, value: string) => dim(report, d).values.find((v) => v.value === value)?.level

describe('constantes de dimensiones', () => {
  it('tienen los valores acordados', () => {
    assert.equal(MAX_MISSING_SHARE, 0.5)
    assert.equal(DURATION_SHORT_BELOW, 2.5)
    assert.equal(DURATION_LONG_FROM, 3.5)
    assert.equal(SILLAGE_SOFT_BELOW, 2)
    assert.equal(SILLAGE_STRONG_FROM, 3)
  })
})

describe('franjas de duración y estela (bordes)', () => {
  it('duración: 2,49 corta, 2,5 media, 3,49 media, 3,5 larga', () => {
    assert.deepEqual([2.49, 2.5, 3.49, 3.5].map(durationBand), ['corta', 'media', 'media', 'larga'])
  })

  it('estela: 1,99 suave, 2 moderada, 2,99 moderada, 3 fuerte', () => {
    assert.deepEqual([1.99, 2, 2.99, 3].map(sillageBand), ['suave', 'moderada', 'moderada', 'fuerte'])
  })

  it('null, undefined y NaN son sin dato', () => {
    for (const bad of [null, undefined, Number.NaN]) {
      assert.equal(durationBand(bad), null)
      assert.equal(sillageBand(bad), null)
    }
  })
})

describe('perfil de un perfume', () => {
  it('"diario" es día; "noche" es noche; otros valores se ignoran', () => {
    assert.deepEqual(profileOf(owned({ occasions: ['diario'] })).dayNight, ['dia'])
    assert.deepEqual(profileOf(owned({ occasions: ['diario', 'noche'] })).dayNight, ['dia', 'noche'])
    assert.equal(profileOf(owned({ occasions: ['cita'] })).dayNight, null)
    assert.equal(profileOf(owned({ occasions: [] })).dayNight, null)
  })

  it('las estaciones guardadas mandan y se ignoran las desconocidas', () => {
    assert.deepEqual(profileOf(owned({ seasons: ['verano', 'otoño', 'marte'] })).season, ['verano', 'otoño'])
  })

  it('sin estaciones guardadas se infieren de los acordes; sin señal es sin dato', () => {
    const accords = [{ name: 'cítrico', intensity: 90 }]
    assert.deepEqual(profileOf({ accords, seasons: [] }).season, inferSeasons(accords))
    assert.ok(inferSeasons(accords).length > 0)
    assert.equal(profileOf({ accords: [{ name: 'cannabis', intensity: 90 }] }).season, null)
  })
})

describe('analyzeDimensions: estado', () => {
  it('sin usables es empty (los deseados y descartados no cubren nada)', () => {
    const report = analyzeDimensions([make('WISHLIST'), make('DISLIKED')], shares())
    assert.equal(report.status, 'empty')
    assert.deepEqual(report.dimensions, [])
  })

  it('con menos de 3 usables describe pero no emite huecos', () => {
    const report = analyzeDimensions([owned({ seasons: ['verano'] }), owned({ seasons: ['verano'] })], shares())
    assert.equal(report.status, 'too_small')
    assert.equal(dim(report, 'season').values.length, 4)
    for (const d of report.dimensions) assert.deepEqual([d.gaps, d.weak, d.unexplored], [[], [], []])
  })
})

describe('analyzeDimensions: estación y día/noche', () => {
  const three = [owned({ seasons: ['verano'] }), owned({ seasons: ['verano', 'primavera'] }), owned({ seasons: ['primavera'] })]

  it('una estación común sin perfumes es hueco, y se ordena por frecuencia en el catálogo', () => {
    const report = analyzeDimensions(three, shares({ season: { primavera: 0.5, verano: 0.5, otoño: 0.3, invierno: 0.4 } }))
    assert.deepEqual(dim(report, 'season').gaps.map((g) => g.value), ['invierno', 'otoño'])
    assert.equal(levelOf(report, 'season', 'verano'), 'covered')
  })

  it('una estación con menos de 20 % del catálogo y sin perfumes es "no explorado" (borde 0,2)', () => {
    const report = analyzeDimensions(three, shares({ season: { primavera: 0.5, verano: 0.5, otoño: 0.19999, invierno: 0.2 } }))
    assert.equal(levelOf(report, 'season', 'otoño'), 'unexplored')
    assert.equal(levelOf(report, 'season', 'invierno'), 'gap')
  })

  it('día/noche: una colección solo diaria tiene hueco de noche', () => {
    const report = analyzeDimensions(Array.from({ length: 3 }, () => owned({ occasions: ['diario'] })), shares())
    assert.deepEqual(dim(report, 'dayNight').gaps.map((g) => g.value), ['noche'])
    assert.equal(dim(report, 'dayNight').values.find((v) => v.value === 'dia')?.count, 3)
  })

  it('cobertura débil con 6 usables (borde 5 / 6) y límite estricto en la mitad', () => {
    const mixed = (n: number) => [owned({ occasions: ['noche'] }), ...Array.from({ length: n - 1 }, () => owned({ occasions: ['diario'] }))]
    // noche: 1 de 5 = 0,2 < 0,25, pero con 5 no se evalúa
    assert.equal(levelOf(analyzeDimensions(mixed(5), shares()), 'dayNight', 'noche'), 'covered')
    // 1 de 6 = 0,1667 < 0,25
    assert.equal(levelOf(analyzeDimensions(mixed(6), shares()), 'dayNight', 'noche'), 'weak')
    // 2 de 8 = 0,25 = 0,5 × 0,5: exactamente la mitad no es débil
    const eight = [owned({ occasions: ['noche'] }), owned({ occasions: ['noche'] }), ...Array.from({ length: 6 }, () => owned({ occasions: ['diario'] }))]
    assert.equal(levelOf(analyzeDimensions(eight, shares()), 'dayNight', 'noche'), 'covered')
  })
})

describe('analyzeDimensions: duración y estela', () => {
  it('sin ninguna duración larga hay hueco si es común en el catálogo', () => {
    const report = analyzeDimensions(Array.from({ length: 3 }, () => owned({ longevity: 3 })), shares({ duration: { corta: 0.1, media: 0.6, larga: 0.3 } }))
    assert.deepEqual(dim(report, 'duration').gaps.map((g) => g.value), ['larga'])
    assert.deepEqual(dim(report, 'duration').unexplored.map((g) => g.value), ['corta'])
  })

  it('la estela es solo informativa: suave sin perfumes no es hueco; fuerte rara es "no explorado"', () => {
    const report = analyzeDimensions(Array.from({ length: 3 }, () => owned({ sillage: 2.5 })), shares({ sillage: { suave: 0.22, moderada: 0.75, fuerte: 0.028 } }))
    const sillage = dim(report, 'sillage')
    assert.deepEqual([sillage.gaps, sillage.weak], [[], []])
    assert.deepEqual(sillage.unexplored.map((g) => g.value), ['fuerte'])
    assert.equal(levelOf(report, 'sillage', 'suave'), 'covered')
    // la distribución de la colección sigue disponible
    assert.equal(sillage.values.find((v) => v.value === 'moderada')?.presence, 1)
  })

  it('la estela tampoco emite cobertura débil, ni con 6 o más perfumes', () => {
    const six = [owned({ sillage: 1 }), ...Array.from({ length: 5 }, () => owned({ sillage: 2.5 }))]
    assert.deepEqual(dim(analyzeDimensions(six, shares()), 'sillage').weak, [])
  })

  it('solo estación, día/noche y duración pueden emitir hueco', () => {
    assert.deepEqual([...GAP_DIMENSIONS], ['season', 'dayNight', 'duration'])
    const report = analyzeDimensions(Array.from({ length: 3 }, () => owned({ seasons: ['verano'], occasions: ['diario'], longevity: 3, sillage: 2.5 })), shares())
    for (const d of report.dimensions) assert.equal(d.gaps.length > 0, GAP_DIMENSIONS.includes(d.dimension))
  })
})

describe('analyzeDimensions: datos faltantes', () => {
  // 4 usables; los que tienen duración la traen, los demás no.
  const withLongevity = (n: number) => [
    ...Array.from({ length: n }, () => owned({ longevity: 3, occasions: ['diario'] })),
    ...Array.from({ length: 4 - n }, () => owned({ occasions: ['diario'] })),
  ]

  it('si falta en más de la mitad no se emite el hueco (1 de 4 con dato)', () => {
    const duration = dim(analyzeDimensions(withLongevity(1), shares()), 'duration')
    assert.equal(duration.status, 'insufficient_data')
    assert.equal(duration.missingShare, 0.75)
    assert.deepEqual([duration.values, duration.gaps, duration.weak, duration.unexplored], [[], [], [], []])
  })

  it('si falta justo la mitad todavía se emite (2 de 4 con dato)', () => {
    const duration = dim(analyzeDimensions(withLongevity(2), shares()), 'duration')
    assert.equal(duration.status, 'ok')
    assert.equal(duration.missingShare, 0.5)
    assert.ok(duration.gaps.length > 0)
  })

  it('sin ningún dato es insufficient_data y las demás dimensiones siguen', () => {
    const report = analyzeDimensions(withLongevity(0), shares())
    assert.equal(dim(report, 'duration').status, 'insufficient_data')
    assert.equal(dim(report, 'dayNight').status, 'ok')
  })

  it('la base de los porcentajes son los perfumes con dato, no todos', () => {
    const duration = dim(analyzeDimensions(withLongevity(2), shares()), 'duration')
    assert.equal(duration.withData, 2)
    assert.equal(duration.values.find((v) => v.value === 'media')?.presence, 1)
  })
})

describe('catalogDimensionShares', () => {
  it('el denominador son los perfumes con dato en esa dimensión', () => {
    const catalog = [
      { accords: [{ name: 'floral', intensity: 80 }], occasions: ['noche'], longevity: 4 },
      { accords: [{ name: 'floral', intensity: 80 }], occasions: ['diario'], longevity: null },
      { accords: [{ name: 'floral', intensity: 80 }], occasions: [], longevity: 2 },
      { accords: [{ name: 'floral', intensity: 80 }], occasions: ['diario', 'noche'], longevity: 3 },
    ]
    const result = catalogDimensionShares(catalog)
    assert.equal(result.dayNight.dia, 2 / 3)
    assert.equal(result.dayNight.noche, 2 / 3)
    assert.equal(result.duration.larga, 1 / 3)
    assert.equal(result.duration.corta, 1 / 3)
    assert.equal(result.duration.media, 1 / 3)
    assert.equal(result.sillage.suave, 0)
  })

  it('los conteos son enteros: perfumes con cada valor y perfumes con dato', () => {
    const catalog = [
      { accords: [{ name: 'floral', intensity: 80 }], occasions: ['noche'], longevity: 4, sillage: 2 },
      { accords: [{ name: 'floral', intensity: 80 }], occasions: ['diario'], longevity: null, sillage: 3 },
      { accords: [{ name: 'floral', intensity: 80 }], occasions: [], longevity: 2, sillage: 1 },
      { accords: [{ name: 'floral', intensity: 80 }], occasions: ['diario', 'noche'], longevity: 3, sillage: null },
    ]
    const { dayNight, duration, sillage } = catalogDimensionCounts(catalog)
    assert.deepEqual(dayNight, { withData: 3, counts: { dia: 2, noche: 2 } })
    assert.deepEqual(duration, { withData: 3, counts: { corta: 1, media: 1, larga: 1 } })
    assert.deepEqual(sillage, { withData: 3, counts: { suave: 1, moderada: 1, fuerte: 1 } })
    for (const { withData, counts } of Object.values(catalogDimensionCounts(catalog))) {
      assert.ok(Number.isInteger(withData) && Object.values(counts).every(Number.isInteger))
    }
  })

  it('un catálogo vacío da 0 sin dividir por cero', () => {
    const result = catalogDimensionShares([])
    for (const d of DIMENSIONS) for (const v of DIMENSION_VALUES[d]) assert.equal(result[d][v], 0)
  })

  it('es determinista', () => {
    const catalog = [{ accords: [{ name: 'cítrico', intensity: 80 }], longevity: 3 }]
    assert.deepEqual(catalogDimensionShares(catalog), catalogDimensionShares([...catalog]))
  })
})
