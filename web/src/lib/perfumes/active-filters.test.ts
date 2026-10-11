import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildActiveFilters } from './active-filters.ts'

describe('buildActiveFilters', () => {
  it('sin parámetros no hay chips', () => {
    assert.deepEqual(buildActiveFilters({}), [])
    assert.deepEqual(buildActiveFilters({ q: '', brand: '' }), [])
  })

  it('arma etiquetas legibles y respeta el orden de los filtros', () => {
    const chips = buildActiveFilters({
      season: 'verano',
      q: 'dior',
      priceTier: 'NICHE',
      concentration: 'edp',
      accord: 'vainilla',
    })
    assert.deepEqual(
      chips.map((c) => [c.key, c.label]),
      [
        ['q', 'Búsqueda: «dior»'],
        ['accord', 'Acorde: Vainilla'],
        ['priceTier', 'Categoría: Nicho'],
        ['concentration', 'Concentración: EDP'],
        ['season', 'Estación: Verano'],
      ],
    )
  })

  it('el orden cuenta como chip y usa su etiqueta', () => {
    const [chip] = buildActiveFilters({ sort: 'longevity-desc' })
    assert.equal(chip.label, 'Orden: Mayor duración')
  })

  it('cada enlace quita solo su filtro y conserva el resto', () => {
    const chips = buildActiveFilters({ q: 'rosa', gender: 'unisex', sort: 'newest' })
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c.removeHref]))
    assert.equal(byKey.q, '/perfumes?gender=unisex&sort=newest')
    assert.equal(byKey.gender, '/perfumes?q=rosa&sort=newest')
    assert.equal(byKey.sort, '/perfumes?q=rosa&gender=unisex')
  })

  it('quitar el último filtro vuelve a /perfumes y descarta la página', () => {
    const [chip] = buildActiveFilters({ brand: 'Dior', page: '3' })
    assert.equal(chip.removeHref, '/perfumes')
    const [a, b] = buildActiveFilters({ brand: 'Dior', gender: 'unisex', page: '3' })
    assert.equal(a.removeHref, '/perfumes?gender=unisex')
    assert.equal(b.removeHref, '/perfumes?brand=Dior')
  })

  it('codifica el texto libre y toma el primer valor de un arreglo', () => {
    const chips = buildActiveFilters({ q: ['a b&c', 'otro'], brand: 'Maison Margiela' })
    assert.equal(chips[0].label, 'Búsqueda: «a b&c»')
    assert.equal(chips[1].removeHref, '/perfumes?q=a+b%26c')
  })

  it('un valor desconocido se muestra tal cual en vez de perderse', () => {
    const [chip] = buildActiveFilters({ season: 'monzón' })
    assert.equal(chip.label, 'Estación: Monzón')
  })

  it('duración mínima y máxima en días/horas del dato', () => {
    const chips = buildActiveFilters({ minLongevity: '3.5', minDuration: '4', maxDuration: '8' })
    assert.deepEqual(
      chips.map((c) => c.label),
      ['Duración: Larga o más', 'Duración mínima: 4 h', 'Duración máxima: 8 h'],
    )
  })
})
