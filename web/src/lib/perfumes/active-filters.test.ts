import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildActiveFilters, suggestFiltersFromQuery } from './active-filters.ts'

describe('buildActiveFilters', () => {
  it('sin parámetros no hay chips', () => {
    assert.deepEqual(buildActiveFilters({}), [])
    assert.deepEqual(buildActiveFilters({ q: '', brand: '' }), [])
  })

  it('arma etiquetas legibles y respeta el orden de los filtros', () => {
    const chips = buildActiveFilters({
      season: 'verano',
      q: 'dior',
      concentration: 'edp',
      accord: 'vainilla',
    })
    assert.deepEqual(
      chips.map((c) => [c.key, c.label]),
      [
        ['q', 'Búsqueda: «dior»'],
        ['accord', 'Acorde: Vainilla'],
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

describe('etiquetas de género y alias', () => {
  it('muestra el género en es-AR', () => {
    const label = (gender: string) => buildActiveFilters({ gender })[0].label
    assert.equal(label('masculino'), 'Para hombres')
    assert.equal(label('femenino'), 'Para mujeres')
    assert.equal(label('unisex'), 'Unisex')
  })

  it('un alias en inglés se muestra y enlaza como el valor canónico', () => {
    const chips = buildActiveFilters({ gender: 'Men', season: 'Verano', q: 'sauvage' })
    assert.equal(chips.find((c) => c.key === 'gender')?.label, 'Para hombres')
    assert.equal(chips.find((c) => c.key === 'q')?.removeHref, '/perfumes?gender=masculino&season=verano')
  })
})

describe('suggestFiltersFromQuery', () => {
  it('sin búsqueda o sin palabras de filtro no sugiere nada', () => {
    assert.equal(suggestFiltersFromQuery({}), null)
    assert.equal(suggestFiltersFromQuery({ q: 'sauvage dior' }), null)
  })

  it('convierte palabras de género y estación en filtros y deja el resto en q', () => {
    const s = suggestFiltersFromQuery({ q: 'sauvage hombres verano' })
    assert.deepEqual(s?.words, ['hombres', 'verano'])
    assert.equal(s?.href, '/perfumes?q=sauvage&gender=masculino&season=verano')
  })

  it('si q son solo filtros, la búsqueda se quita; conserva otros filtros', () => {
    const s = suggestFiltersFromQuery({ q: 'Mujeres', brand: 'Dior' })
    assert.equal(s?.href, '/perfumes?brand=Dior&gender=femenino')
  })

  it('no pisa un filtro ya elegido', () => {
    assert.equal(suggestFiltersFromQuery({ q: 'hombres', gender: 'unisex' }), null)
  })
})
