import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { average, barWidth, buildTimeline, monthLabel, pageCount, parsePage, parseSavedFilters, percent, totalsByStatus } from './audit-report.ts'

describe('average y percent', () => {
  it('null sin datos, nunca NaN ni división por cero', () => {
    assert.equal(average(10, 0), null)
    assert.equal(average(NaN, 3), null)
    assert.equal(average(0, 4), 0)
    assert.equal(percent(1, 0), null)
    assert.equal(percent(Infinity, 3), null)
  })
  it('redondea', () => {
    assert.equal(average(10, 3), 3.3)
    assert.equal(average(10, 3, 2), 3.33)
    assert.equal(percent(1, 3), 33)
    assert.equal(percent(2, 3), 67)
  })
})

describe('buildTimeline', () => {
  it('sin datos queda vacío', () => assert.deepEqual(buildTimeline([], []), []))
  it('completa los meses sin movimiento, también al cruzar de año', () => {
    const rows = buildTimeline([{ month: '2026-11', count: 2 }], [{ month: '2027-02', count: 1 }])
    assert.deepEqual(rows.map((r) => r.month), ['2026-11', '2026-12', '2027-01', '2027-02'])
    assert.deepEqual(rows.map((r) => r.net), [2, 0, 0, -1])
  })
  it('suma repetidos e ignora meses inválidos y conteos no positivos', () => {
    const rows = buildTimeline(
      [{ month: '2026-10', count: 1 }, { month: '2026-10', count: 2 }, { month: '2026-13', count: 9 }, { month: 'x', count: 5 }, { month: '2026-09', count: -3 }],
      [],
    )
    assert.deepEqual(rows, [{ month: '2026-10', registered: 3, deleted: 0, net: 3 }])
  })
  it('conserva solo los últimos meses', () => {
    const rows = buildTimeline([{ month: '2024-01', count: 1 }, { month: '2026-10', count: 1 }], [], 6)
    assert.equal(rows.length, 6)
    assert.equal(rows[rows.length - 1].month, '2026-10')
  })
})

describe('totalsByStatus', () => {
  it('reparte por estado e ignora los desconocidos y los negativos', () => {
    const t = totalsByStatus([
      { status: 'OWNED', count: 5 }, { status: 'WISHLIST', count: 2 }, { status: 'OWNED', count: 1 },
      { status: 'OTRO', count: 9 }, { status: 'DISLIKED', count: -4 },
    ])
    assert.deepEqual(t, { owned: 6, sampled: 0, wishlist: 2, disliked: 0, total: 8 })
  })
})

describe('barWidth y monthLabel', () => {
  it('ancho proporcional y acotado', () => {
    assert.equal(barWidth(5, 10), 50)
    assert.equal(barWidth(20, 10), 100)
    assert.equal(barWidth(0, 10), 0)
    assert.equal(barWidth(3, 0), 0)
    assert.equal(barWidth(NaN, 10), 0)
  })
  it('etiqueta de mes', () => {
    assert.equal(monthLabel('2026-10'), 'oct 2026')
    assert.equal(monthLabel('2026-01'), 'ene 2026')
    assert.equal(monthLabel('raro'), 'raro')
  })
})

describe('paginación', () => {
  it('pageCount: mínimo 1 y redondea hacia arriba', () => {
    assert.equal(pageCount(0, 50), 1)
    assert.equal(pageCount(50, 50), 1)
    assert.equal(pageCount(51, 50), 2)
    assert.equal(pageCount(10, 0), 1)
    assert.equal(pageCount(NaN, 50), 1)
  })
  it('parsePage: acota y no se deja engañar por valores raros', () => {
    assert.equal(parsePage('3', 5), 3)
    assert.equal(parsePage('9', 5), 5)
    assert.equal(parsePage('0', 5), 1)
    assert.equal(parsePage('-2', 5), 1)
    assert.equal(parsePage('2.5', 5), 1)
    assert.equal(parsePage('abc', 5), 1)
    assert.equal(parsePage('', 5), 1)
    assert.equal(parsePage(undefined, 5), 1)
    assert.equal(parsePage(['4', '2'], 5), 4)
    assert.equal(parsePage('99999999999', 5), 1)
    assert.equal(parsePage('2', 0), 1)
  })
  it('parseSavedFilters: solo acepta valores de la lista fija', () => {
    assert.deepEqual(parseSavedFilters({ genero: 'femenino', estado: 'OWNED' }), { gender: 'femenino', status: 'OWNED' })
    assert.deepEqual(parseSavedFilters({}), { gender: null, status: null })
    assert.deepEqual(parseSavedFilters({ genero: ['unisex', 'x'], estado: ['WISHLIST'] }), { gender: 'unisex', status: 'WISHLIST' })
    for (const bad of ['FEMENINO', "x' OR 1=1 --", 'todos', '', 'owned']) {
      assert.deepEqual(parseSavedFilters({ genero: bad, estado: bad }), { gender: null, status: null }, bad)
    }
  })
})
