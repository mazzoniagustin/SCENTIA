import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { analyzeFamilies } from './analyze.ts'
import { analyzeDimensions, type DimensionShares } from './dimensions.ts'
import {
  EXCLUDED_FROM_SUGGESTIONS,
  IDF_SATURATION,
  MAX_CANDIDATES,
  MAX_PER_BRAND,
  MIN_CANDIDATES,
  NEED_WEIGHT_GAP,
  NEED_WEIGHT_WEAK,
  POPULARITY_WEIGHT,
  RARITY_WEIGHT,
  WISHLIST_LABEL,
  buildNeeds,
  rankSuggestions,
  type Need,
  type RankCandidate,
} from './rank.ts'
import type { CatalogShares, CollectionSample, CollectionStatus } from './types.ts'

const RARE = IDF_SATURATION // acorde "raro" al 100 %
const idfTable: Record<string, number> = { cítrico: RARE, floral: RARE, tropical: RARE, afrutado: RARE / 4, ámbar: RARE }
const idf = (name: string) => idfTable[name] ?? 0

let seq = 0
const candidate = (accords: Array<[string, number]>, extra: Partial<RankCandidate> = {}): RankCandidate => ({
  perfumeId: `c${String(++seq).padStart(3, '0')}`,
  brand: `Marca ${seq}`,
  collectionStatus: null,
  accords: accords.map(([name, intensity]) => ({ name, intensity })),
  ...extra,
})
const citrus: Need = { kind: 'family', family: 'citrico', weight: NEED_WEIGHT_GAP }
const floral: Need = { kind: 'family', family: 'floral', weight: NEED_WEIGHT_GAP }
const WITH_NO_POPULARITY_FACTOR = 1 - POPULARITY_WEIGHT

describe('constantes del ranking', () => {
  it('tienen los valores acordados', () => {
    assert.equal(MAX_CANDIDATES, 5)
    assert.equal(MAX_PER_BRAND, 2)
    assert.equal(MIN_CANDIDATES, 3)
    assert.equal(NEED_WEIGHT_GAP, 1)
    assert.equal(NEED_WEIGHT_WEAK, 0.5)
    assert.equal(RARITY_WEIGHT, 0.3)
    assert.equal(POPULARITY_WEIGHT, 0.3)
    assert.equal(IDF_SATURATION, Math.log(10))
    assert.deepEqual([...EXCLUDED_FROM_SUGGESTIONS].sort(), ['DISLIKED', 'OWNED', 'SAMPLED'])
    assert.equal(WISHLIST_LABEL, 'Ya lo tenés en tu lista de deseados')
  })
})

describe('buildNeeds', () => {
  const famShares = Object.fromEntries(
    ['citrico', 'afrutado', 'verde', 'floral', 'empolvado', 'dulce', 'ambar', 'amaderado', 'cuero', 'acuatico'].map((f) => [f, 0.5]),
  ) as CatalogShares
  const dimShares = {
    season: { primavera: 0.5, verano: 0.5, otoño: 0.5, invierno: 0.5 },
    dayNight: { dia: 0.5, noche: 0.5 },
    duration: { corta: 0.1, media: 0.6, larga: 0.3 },
    sillage: { suave: 0.5, moderada: 0.5, fuerte: 0.5 },
  } as DimensionShares
  const sample = (status: CollectionStatus, extra: Partial<CollectionSample> = {}): CollectionSample => ({
    perfumeId: `s${++seq}`,
    status,
    accords: [{ name: 'cítrico', intensity: 80 }],
    ...extra,
  })

  it('sin huecos medibles (vacío o colección chica) no hay necesidades', () => {
    assert.deepEqual(buildNeeds(analyzeFamilies([], famShares), analyzeDimensions([], dimShares)), [])
    const small = [sample('OWNED'), sample('OWNED')]
    assert.deepEqual(buildNeeds(analyzeFamilies(small, famShares), analyzeDimensions(small, dimShares)), [])
  })

  it('huecos pesan 1, cobertura débil 0,5; no explorado y estela no se buscan', () => {
    const collection = Array.from({ length: 6 }, () =>
      sample('OWNED', { seasons: ['verano'], occasions: ['diario'], longevity: 3, sillage: 2.5 }),
    )
    const needs = buildNeeds(analyzeFamilies(collection, famShares), analyzeDimensions(collection, dimShares))
    assert.ok(needs.every((n) => n.weight === NEED_WEIGHT_GAP || n.weight === NEED_WEIGHT_WEAK))
    assert.ok(needs.some((n) => n.kind === 'family' && n.family === 'floral' && n.weight === NEED_WEIGHT_GAP))
    assert.ok(needs.some((n) => n.kind === 'dimension' && n.dimension === 'duration' && n.value === 'larga'))
    assert.ok(!needs.some((n) => n.kind === 'dimension' && n.value === 'corta'), 'corta es "no explorado"')
    assert.ok(!needs.some((n) => n.kind === 'dimension' && n.dimension === 'sillage'), 'la estela es solo informativa')
  })
})

describe('rankSuggestions: exclusiones', () => {
  it('saca OWNED, SAMPLED y DISLIKED; deja los de la lista de deseados, marcados, y los que no están', () => {
    const owned = candidate([['cítrico', 90]], { collectionStatus: 'OWNED' })
    const sampled = candidate([['cítrico', 90]], { collectionStatus: 'SAMPLED' })
    const disliked = candidate([['cítrico', 90]], { collectionStatus: 'DISLIKED' })
    const wish = candidate([['cítrico', 90]], { collectionStatus: 'WISHLIST' })
    const fresh = candidate([['cítrico', 90]])
    const { suggestions } = rankSuggestions([citrus], [owned, sampled, disliked, wish, fresh], idf)
    assert.deepEqual(suggestions.map((s) => s.perfumeId).sort(), [fresh.perfumeId, wish.perfumeId].sort())
    assert.equal(suggestions.find((s) => s.perfumeId === wish.perfumeId)?.inWishlist, true)
    assert.equal(suggestions.find((s) => s.perfumeId === fresh.perfumeId)?.inWishlist, false)
  })

  it('un descartado excluye solo ese perfume, no a otros con los mismos acordes', () => {
    const disliked = candidate([['cítrico', 90], ['floral', 90]], { collectionStatus: 'DISLIKED' })
    const twin = candidate([['cítrico', 90], ['floral', 90]])
    const { suggestions } = rankSuggestions([citrus, floral], [disliked, twin], idf)
    assert.deepEqual(suggestions.map((s) => s.perfumeId), [twin.perfumeId])
  })

  it('sin necesidades no sugiere nada', () => {
    assert.deepEqual(rankSuggestions([], [candidate([['cítrico', 90]])], idf), { suggestions: [], complete: false, needs: [] })
  })

  it('un candidato que no cubre ninguna necesidad no aparece', () => {
    assert.deepEqual(rankSuggestions([citrus], [candidate([['floral', 99]])], idf).suggestions, [])
  })
})

describe('rankSuggestions: puntaje', () => {
  it('el acorde cuenta desde intensidad 40 (borde 39 / 40)', () => {
    const at = candidate([['cítrico', 40]])
    const below = candidate([['cítrico', 39]])
    assert.deepEqual(rankSuggestions([citrus], [at, below], idf).suggestions.map((s) => s.perfumeId), [at.perfumeId])
  })

  it('valor exacto: acorde raro a 100 sin popularidad = 1 × (1 − peso de popularidad)', () => {
    const [top] = rankSuggestions([citrus], [candidate([['cítrico', 100]])], idf).suggestions
    assert.ok(Math.abs(top.score - WITH_NO_POPULARITY_FACTOR) < 1e-12)
  })

  it('cubrir dos necesidades gana a cubrir una', () => {
    const both = candidate([['cítrico', 80], ['floral', 80]])
    const one = candidate([['cítrico', 100]])
    const { suggestions } = rankSuggestions([citrus, floral], [one, both], idf)
    assert.deepEqual(suggestions.map((s) => s.perfumeId), [both.perfumeId, one.perfumeId])
    assert.equal(suggestions[0].covers.length, 2)
  })

  it('una necesidad de cobertura débil pesa la mitad que un hueco', () => {
    const weak: Need = { kind: 'family', family: 'floral', weight: NEED_WEIGHT_WEAK }
    const gapOnly = candidate([['cítrico', 100]])
    const weakOnly = candidate([['floral', 100]])
    const { suggestions } = rankSuggestions([citrus, weak], [weakOnly, gapOnly], idf)
    assert.deepEqual(suggestions.map((s) => s.perfumeId), [gapOnly.perfumeId, weakOnly.perfumeId])
    assert.ok(Math.abs(suggestions[0].score / suggestions[1].score - 2) < 1e-9)
  })

  it('a igual intensidad gana el acorde más raro; la rareza se satura en IDF_SATURATION', () => {
    const rare = candidate([['tropical', 80]])
    const common = candidate([['afrutado', 80]])
    const need: Need = { kind: 'family', family: 'afrutado', weight: 1 }
    assert.deepEqual(rankSuggestions([need], [common, rare], idf).suggestions.map((s) => s.perfumeId), [rare.perfumeId, common.perfumeId])
    const rarer = (name: string) => (name === 'tropical' ? RARE * 5 : 0)
    const a = rankSuggestions([need], [candidate([['tropical', 80]])], rarer).suggestions[0].score
    const b = rankSuggestions([need], [candidate([['tropical', 80]])], idf).suggestions[0].score
    assert.equal(a, b)
  })

  it('a igual cobertura gana el más popular; la popularidad se acota a 0-1', () => {
    const popular = candidate([['cítrico', 80]], { popularity: 1 })
    const obscure = candidate([['cítrico', 80]], { popularity: 0 })
    const { suggestions } = rankSuggestions([citrus], [obscure, popular], idf)
    assert.deepEqual(suggestions.map((s) => s.perfumeId), [popular.perfumeId, obscure.perfumeId])
    const over = rankSuggestions([citrus], [candidate([['cítrico', 80]], { popularity: 7 })], idf).suggestions[0].score
    assert.equal(over, suggestions[0].score)
  })

  it('cubre necesidades de dimensión: duración larga desde 3,5 (borde 3,49 / 3,5)', () => {
    const need: Need = { kind: 'dimension', dimension: 'duration', value: 'larga', weight: 1 }
    const long = candidate([['floral', 80]], { longevity: 3.5 })
    const medium = candidate([['floral', 80]], { longevity: 3.49 })
    const { suggestions } = rankSuggestions([need], [medium, long], idf)
    assert.deepEqual(suggestions.map((s) => s.perfumeId), [long.perfumeId])
    assert.deepEqual(suggestions[0].covers, [{ kind: 'dimension', dimension: 'duration', value: 'larga' }])
  })
})

describe('rankSuggestions: cantidad, orden y determinismo', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => candidate([['cítrico', 90 - i]]))

  it('devuelve hasta 5 aunque haya más, y respeta un límite menor', () => {
    assert.equal(rankSuggestions([citrus], many(9), idf).suggestions.length, MAX_CANDIDATES)
    assert.equal(rankSuggestions([citrus], many(9), idf, 2).suggestions.length, 2)
    assert.equal(rankSuggestions([citrus], many(9), idf, 99).suggestions.length, MAX_CANDIDATES)
  })

  it('complete es false con 2 candidatos y true con 3 (borde)', () => {
    assert.equal(rankSuggestions([citrus], many(2), idf).complete, false)
    assert.equal(rankSuggestions([citrus], many(3), idf).complete, true)
  })

  it('desempate total: puntaje, más necesidades cubiertas, id', () => {
    const b = { ...candidate([['cítrico', 80]]), perfumeId: 'b' }
    const a = { ...candidate([['cítrico', 80]]), perfumeId: 'a' }
    assert.deepEqual(rankSuggestions([citrus], [b, a], idf).suggestions.map((s) => s.perfumeId), ['a', 'b'])
  })

  it('como mucho 2 de la misma marca: 2 entran, el 3.º se saltea y entra el siguiente (borde 2 / 3)', () => {
    const house = (intensity: number) => candidate([['cítrico', intensity]], { brand: 'Casa Uno' })
    const [a, b, c] = [house(100), house(95), house(90)]
    const other = candidate([['cítrico', 50]], { brand: 'Otra Casa' })
    const two = rankSuggestions([citrus], [a, b, other], idf).suggestions.map((s) => s.perfumeId)
    assert.deepEqual(two, [a.perfumeId, b.perfumeId, other.perfumeId])
    const three = rankSuggestions([citrus], [a, b, c, other], idf).suggestions.map((s) => s.perfumeId)
    assert.deepEqual(three, [a.perfumeId, b.perfumeId, other.perfumeId])
  })

  it('la marca no distingue mayúsculas ni espacios y el tope no recorta el límite si hay otras marcas', () => {
    const same = [' casa uno', 'CASA UNO', 'Casa Uno'].map((brand, i) => candidate([['cítrico', 90 - i]], { brand }))
    const others = Array.from({ length: 4 }, (_, i) => candidate([['cítrico', 60 - i]], { brand: `Distinta ${i}` }))
    const { suggestions } = rankSuggestions([citrus], [...same, ...others], idf)
    assert.equal(suggestions.length, MAX_CANDIDATES)
    assert.equal(suggestions.filter((s) => same.some((c) => c.perfumeId === s.perfumeId)).length, MAX_PER_BRAND)
  })

  it('con el tope por marca el resultado sigue siendo determinista, entre empates y con la entrada en otro orden', () => {
    const tied = ['z', 'y', 'x', 'w'].map((id) => ({ ...candidate([['cítrico', 80]], { brand: 'Casa Uno' }), perfumeId: id }))
    const forward = rankSuggestions([citrus], tied, idf)
    const backward = rankSuggestions([citrus], [...tied].reverse(), idf)
    assert.deepEqual(forward, backward)
    assert.deepEqual(forward.suggestions.map((s) => s.perfumeId), ['w', 'x'])
  })

  it('el orden de entrada no cambia el resultado', () => {
    const list = many(7)
    const forward = rankSuggestions([citrus], list, idf)
    const backward = rankSuggestions([citrus], [...list].reverse(), idf)
    assert.deepEqual(forward, backward)
  })
})
