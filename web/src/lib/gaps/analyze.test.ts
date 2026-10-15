import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  ACCORD_PRESENCE_MIN_INTENSITY,
  MIN_USABLE_ITEMS,
  UNEXPLORED_CATALOG_SHARE,
  WEAK_COVERAGE_MIN_ITEMS,
  WEAK_COVERAGE_RATIO,
  analyzeFamilies,
  catalogFamilyShares,
  familiesOfAccords,
} from './analyze.ts'
import { FAMILY_ORDER, type FamilyCode } from './families.ts'
import type { CatalogShares, CollectionSample, CollectionStatus } from './types.ts'

const shares = (overrides: Partial<Record<FamilyCode, number>> = {}): CatalogShares =>
  ({ ...Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0.5])), ...overrides }) as CatalogShares

let seq = 0
const sample = (status: CollectionStatus, ...names: string[]): CollectionSample => ({
  perfumeId: `p${++seq}`,
  status,
  accords: names.map((name) => ({ name, intensity: 80 })),
})
const owned = (...names: string[]) => sample('OWNED', ...names)
const level = (report: ReturnType<typeof analyzeFamilies>, family: FamilyCode) => report.families.find((c) => c.family === family)?.level

describe('constantes', () => {
  it('tienen los valores acordados', () => {
    assert.equal(ACCORD_PRESENCE_MIN_INTENSITY, 40)
    assert.equal(MIN_USABLE_ITEMS, 3)
    assert.equal(UNEXPLORED_CATALOG_SHARE, 0.2)
    assert.equal(WEAK_COVERAGE_MIN_ITEMS, 6)
    assert.equal(WEAK_COVERAGE_RATIO, 0.5)
  })
})

describe('familiesOfAccords', () => {
  it('el umbral de intensidad es inclusivo en 40', () => {
    assert.deepEqual([...familiesOfAccords([{ name: 'cítrico', intensity: 40 }])], ['citrico'])
    assert.deepEqual([...familiesOfAccords([{ name: 'cítrico', intensity: 39 }])], [])
  })

  it('varios acordes de la misma familia cuentan una vez y los sin familia se ignoran', () => {
    const found = familiesOfAccords([
      { name: 'floral', intensity: 90 },
      { name: 'rosa', intensity: 70 },
      { name: 'cannabis', intensity: 100 },
    ])
    assert.deepEqual([...found], ['floral'])
  })
})

describe('analyzeFamilies: estado según la cantidad de perfumes', () => {
  it('sin perfumes usables es empty, aunque haya deseados y descartados', () => {
    const report = analyzeFamilies([sample('WISHLIST', 'cítrico'), sample('DISLIKED', 'floral')], shares())
    assert.equal(report.status, 'empty')
    assert.deepEqual(report.coverage, { used: 0, skippedWithoutAccords: 0, notUsable: 2 })
    assert.deepEqual(report.families, [])
  })

  it('con 2 usables es too_small: describe pero no marca huecos', () => {
    const report = analyzeFamilies([owned('cítrico'), owned('floral')], shares())
    assert.equal(report.status, 'too_small')
    assert.equal(report.families.length, 10)
    assert.deepEqual([report.gaps, report.weak, report.unexplored], [[], [], []])
  })

  it('con 3 usables ya es ok (borde)', () => {
    const report = analyzeFamilies([owned('cítrico'), owned('floral'), owned('ámbar')], shares())
    assert.equal(report.status, 'ok')
    assert.ok(report.gaps.length > 0)
  })

  it('SAMPLED cuenta igual que OWNED; WISHLIST y DISLIKED no cubren nada', () => {
    const report = analyzeFamilies(
      [owned('cítrico'), sample('SAMPLED', 'floral'), owned('ámbar'), sample('WISHLIST', 'amaderado'), sample('DISLIKED', 'dulce')],
      shares(),
    )
    assert.equal(report.coverage.used, 3)
    assert.equal(report.coverage.notUsable, 2)
    assert.equal(level(report, 'amaderado'), 'gap')
    assert.equal(level(report, 'dulce'), 'gap')
    assert.equal(level(report, 'floral'), 'covered')
  })

  it('los usables sin acordes se cuentan aparte y no entran en la base', () => {
    const report = analyzeFamilies([owned('cítrico'), owned('floral'), owned(), owned('ámbar')], shares())
    assert.deepEqual(report.coverage, { used: 3, skippedWithoutAccords: 1, notUsable: 0 })
    assert.equal(report.status, 'ok')
  })
})

describe('analyzeFamilies: hueco, no explorado y cobertura débil', () => {
  const base = [owned('cítrico'), owned('floral'), owned('ámbar')]

  it('familia común con 0 perfumes es hueco', () => {
    assert.equal(level(analyzeFamilies(base, shares()), 'amaderado'), 'gap')
  })

  it('familia con menos de 20 % del catálogo y 0 perfumes es "no explorado", nunca hueco (borde exacto en 0,2)', () => {
    const rare = analyzeFamilies(base, shares({ cuero: 0.19999, acuatico: 0.2 }))
    assert.equal(level(rare, 'cuero'), 'unexplored')
    assert.equal(level(rare, 'acuatico'), 'gap')
    assert.deepEqual(rare.unexplored.map((c) => c.family), ['cuero'])
    assert.ok(!rare.gaps.some((c) => c.family === 'cuero'))
  })

  it('una familia rara que sí tenés queda "covered", ni débil ni explorada', () => {
    const report = analyzeFamilies([owned('cuero'), owned('floral'), owned('ámbar')], shares({ cuero: 0.1 }))
    assert.equal(level(report, 'cuero'), 'covered')
  })

  it('la cobertura débil solo se evalúa con 6 o más usables (borde 5 / 6)', () => {
    const five = [owned('cítrico'), owned('floral'), owned('floral'), owned('floral'), owned('floral')]
    // citrico: 1 de 5 = 0,2 < 0,5 × 0,5 = 0,25, pero con 5 perfumes no se evalúa
    assert.equal(level(analyzeFamilies(five, shares()), 'citrico'), 'covered')
    const six = [...five, owned('floral')]
    // 1 de 6 = 0,1667 < 0,25 → débil
    assert.equal(level(analyzeFamilies(six, shares()), 'citrico'), 'weak')
  })

  it('el límite de cobertura débil es estricto: exactamente la mitad de la frecuencia no es débil', () => {
    // 8 perfumes, 2 cítricos: presencia 0,25 = 0,5 × 0,5
    const at = [owned('cítrico'), owned('cítrico'), ...Array.from({ length: 6 }, () => owned('floral'))]
    assert.equal(level(analyzeFamilies(at, shares()), 'citrico'), 'covered')
    // 1 cítrico de 8: 0,125 < 0,25
    const below = [owned('cítrico'), ...Array.from({ length: 7 }, () => owned('floral'))]
    assert.equal(level(analyzeFamilies(below, shares()), 'citrico'), 'weak')
  })

  it('ordena los huecos por frecuencia en el catálogo y luego por el orden de las familias', () => {
    const report = analyzeFamilies(base, shares({ amaderado: 0.6, dulce: 0.6, verde: 0.55, afrutado: 0.3 }))
    assert.deepEqual(report.gaps.map((c) => c.family).slice(0, 4), ['dulce', 'amaderado', 'verde', 'empolvado'])
  })

  it('es determinista: misma entrada, mismo informe', () => {
    const a = analyzeFamilies(base, shares())
    const b = analyzeFamilies([...base], shares())
    assert.deepEqual(a, b)
  })
})

describe('acordes ausentes en la base (pera, cremoso)', () => {
  const catalog = [
    [{ name: 'afrutado', intensity: 90 }],
    [{ name: 'floral', intensity: 90 }],
    [{ name: 'cítrico', intensity: 90 }],
    [{ name: 'ámbar', intensity: 90 }],
  ]

  it('(a) que figuren en la familia no rompe el cálculo ni infla su frecuencia', () => {
    const result = catalogFamilyShares(catalog)
    assert.equal(result.afrutado, 0.25)
    assert.equal(result.dulce, 0)
    for (const family of FAMILY_ORDER) assert.ok(Number.isFinite(result[family]) && result[family] >= 0 && result[family] <= 1)
    assert.doesNotThrow(() => analyzeFamilies([owned('afrutado'), owned('floral'), owned('cítrico')], result))
  })

  it('(a) un catálogo vacío da frecuencia 0 y no divide por cero', () => {
    assert.ok(FAMILY_ORDER.every((f) => catalogFamilyShares([])[f] === 0))
  })

  it('(b) si aparecen datos con esos acordes, cuentan sin tocar el código', () => {
    const withData = [...catalog, [{ name: 'pera', intensity: 80 }], [{ name: 'cremoso', intensity: 80 }]]
    const result = catalogFamilyShares(withData)
    assert.equal(result.afrutado, 2 / 6)
    assert.equal(result.dulce, 1 / 6)
    const report = analyzeFamilies([owned('pera'), owned('cremoso'), owned('floral')], result)
    assert.equal(level(report, 'afrutado'), 'covered')
    assert.equal(level(report, 'dulce'), 'covered')
  })
})
