import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { analyzeFamilies } from './analyze.ts'
import { analyzeDimensions, type DimensionShares } from './dimensions.ts'
import { FAMILY_ORDER } from './families.ts'
import { buildGapsResponse, type GapAnalysisInput } from './response.ts'
import { buildNeeds, WISHLIST_LABEL } from './rank.ts'
import { DAY_NIGHT_NOTE, guideFor, headlineText } from './texts.ts'
import type { CatalogShares, CollectionSample, CollectionStatus } from './types.ts'

const famShares = Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0.5])) as CatalogShares
const dimShares = {
  season: { primavera: 0.5, verano: 0.5, otoño: 0.5, invierno: 0.5 },
  dayNight: { dia: 0.9, noche: 0.5 },
  duration: { corta: 0.08, media: 0.6, larga: 0.3 },
  sillage: { suave: 0.22, moderada: 0.75, fuerte: 0.03 },
} as DimensionShares

let seq = 0
const sample = (status: CollectionStatus, extra: Partial<CollectionSample> = {}): CollectionSample => ({
  perfumeId: `secret-${++seq}`,
  status,
  accords: [{ name: 'cítrico', intensity: 80 }],
  ...extra,
})

function analysisFor(samples: CollectionSample[], suggestions: GapAnalysisInput['suggestions'] = []): GapAnalysisInput {
  const families = analyzeFamilies(samples, famShares)
  const dimensions = analyzeDimensions(samples, dimShares)
  return { families, dimensions, needs: buildNeeds(families, dimensions), suggestions, complete: suggestions.length >= 3 }
}

const six = () => Array.from({ length: 6 }, () => sample('OWNED', { seasons: ['verano'], occasions: ['diario'], longevity: 3, sillage: 2.5 }))

describe('buildGapsResponse: sin datos suficientes', () => {
  it('colección vacía: solo guía, sin análisis', () => {
    const r = buildGapsResponse(analysisFor([]))
    assert.equal(r.status, 'empty')
    assert.equal(r.guide?.title, guideFor('empty', 0, 0).title)
    assert.deepEqual([r.headline, r.findings, r.families, r.dimensions, r.suggestions], [null, [], [], [], []])
  })

  it('solo deseados y descartados: la guía lo explica', () => {
    const r = buildGapsResponse(analysisFor([sample('WISHLIST'), sample('DISLIKED')]))
    assert.equal(r.status, 'empty')
    assert.match(r.guide!.text, /deseados o descartados/)
  })

  it('con 2 usables (menos de 3): guía general y ningún análisis, ni descriptivo', () => {
    const r = buildGapsResponse(analysisFor([sample('OWNED'), sample('SAMPLED')]))
    assert.equal(r.status, 'too_small')
    assert.match(r.guide!.text, /2 perfumes/)
    assert.deepEqual([r.findings, r.families, r.dimensions, r.notes], [[], [], [], []])
  })
})

describe('buildGapsResponse: con análisis', () => {
  const response = buildGapsResponse(analysisFor(six()))

  it('con 3 o más usables hay análisis y no hay guía', () => {
    assert.equal(response.status, 'ok')
    assert.equal(response.guide, null)
    assert.equal(response.source, 'template')
    assert.ok(response.findings.some((f) => f.kind === 'gap' && f.area === 'family' && f.code === 'floral'))
  })

  it('los hallazgos van en orden: huecos, cobertura débil, no explorado', () => {
    const order = ['gap', 'weak', 'unexplored']
    const kinds = response.findings.map((f) => order.indexOf(f.kind))
    assert.deepEqual(kinds, [...kinds].sort((a, b) => a - b))
  })

  it('la estela nunca es hueco ni cobertura débil; fuerte aparece solo como "no explorado" y es informativa', () => {
    assert.ok(!response.findings.some((f) => f.area === 'sillage' && f.kind !== 'unexplored'))
    const sillage = response.dimensions.find((d) => d.dimension === 'sillage')!
    assert.equal(sillage.informational, true)
    assert.equal(response.dimensions.find((d) => d.dimension === 'duration')!.informational, false)
    const fuerte = response.findings.find((f) => f.area === 'sillage')
    assert.equal(fuerte?.kind, 'unexplored')
    assert.match(fuerte!.text, /Todavía no exploraste/)
  })

  it('"no explorado" no usa lenguaje de carencia', () => {
    for (const f of response.findings.filter((x) => x.kind === 'unexplored')) assert.doesNotMatch(f.text, /falta|hueco|ninguno de tus/i)
  })

  it('incluye la nota de día/noche cuando se analizó esa dimensión', () => {
    assert.ok(response.notes.includes(DAY_NIGHT_NOTE))
  })

  it('una dimensión sin datos suficientes se explica y no emite hallazgos', () => {
    const r = buildGapsResponse(analysisFor(Array.from({ length: 4 }, () => sample('OWNED', { seasons: ['verano'] }))))
    const duration = r.dimensions.find((d) => d.dimension === 'duration')!
    assert.equal(duration.status, 'insufficient_data')
    assert.ok(r.notes.some((n) => /No analizamos «Duración»/.test(n)))
    assert.ok(!r.findings.some((f) => f.area === 'duration'))
  })

  it('el titular cuenta huecos y áreas débiles', () => {
    assert.equal(headlineText(6, 2, 1), 'En tus 6 perfumes encontramos 2 huecos y 1 área con poca presencia.')
    assert.equal(headlineText(6, 0, 0), 'No encontramos huecos en tus 6 perfumes con lo que podemos medir.')
  })
})

describe('buildGapsResponse: nada privado sale', () => {
  const suggestions: GapAnalysisInput['suggestions'] = [
    { perfumeId: 'cat-1', brand: 'Casa', name: 'Uno', gender: 'unisex', imageUrl: null, score: 0.8123, covers: [{ kind: 'family', family: 'floral' }], inWishlist: true },
    { perfumeId: 'cat-2', brand: 'Otra', name: 'Dos', gender: 'femenino', imageUrl: 'https://fimgs.net/x.jpg', score: 0.5, covers: [{ kind: 'dimension', dimension: 'duration', value: 'larga' }], inWishlist: false },
  ]
  const samples = six().map((s, i) => ({ ...s, rating: 5, personalNotes: `nota privada ${i}`, userId: 'user-xyz' }))
  const json = JSON.stringify(buildGapsResponse(analysisFor(samples as CollectionSample[], suggestions)))

  it('no incluye ids de la colección, notas, puntajes de la persona ni ids de usuario', () => {
    for (const forbidden of ['secret-', 'nota privada', 'personalNotes', 'user-xyz', 'userId', 'rating']) {
      assert.ok(!json.includes(forbidden), `la respuesta contiene "${forbidden}"`)
    }
  })

  it('no incluye el puntaje interno del ranking', () => {
    assert.ok(!json.includes('0.8123') && !json.includes('"score"'))
  })

  it('los candidatos salen con etiquetas legibles y la marca de deseados', () => {
    const r = buildGapsResponse(analysisFor(six(), suggestions))
    assert.deepEqual(r.suggestions.map((s) => s.perfumeId), ['cat-1', 'cat-2'])
    assert.deepEqual(r.suggestions[0].covers, ['Floral'])
    assert.deepEqual(r.suggestions[1].covers, ['Duración: Duración larga'])
    assert.equal(r.suggestions[0].wishlistNote, WISHLIST_LABEL)
    assert.equal(r.suggestions[1].wishlistNote, null)
    assert.equal(r.complete, false)
  })
})
