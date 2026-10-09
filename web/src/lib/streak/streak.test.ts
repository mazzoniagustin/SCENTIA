import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isDayKey, lastDays, shiftDay, summarizeStreak } from './streak.ts'

describe('shiftDay', () => {
  it('cruza meses, años y bisiestos', () => {
    assert.equal(shiftDay('2026-10-31', 1), '2026-11-01')
    assert.equal(shiftDay('2026-01-01', -1), '2025-12-31')
    assert.equal(shiftDay('2028-02-28', 1), '2028-02-29')
    assert.equal(shiftDay('2026-03-01', -1), '2026-02-28')
  })
})

describe('isDayKey', () => {
  it('acepta solo fechas reales en formato YYYY-MM-DD', () => {
    assert.equal(isDayKey('2026-10-09'), true)
    assert.equal(isDayKey('2026-02-30'), false)
    assert.equal(isDayKey('2026-1-9'), false)
    assert.equal(isDayKey(20261009), false)
  })
})

describe('summarizeStreak', () => {
  const today = '2026-10-09'

  it('sin registros: todo en cero', () => {
    assert.deepEqual(summarizeStreak([], today), { current: 0, best: 0, loggedToday: false, total: 0 })
  })

  it('registró hoy: cuenta hoy y los días anteriores seguidos', () => {
    const s = summarizeStreak(['2026-10-07', '2026-10-08', '2026-10-09'], today)
    assert.deepEqual(s, { current: 3, best: 3, loggedToday: true, total: 3 })
  })

  it('no registró hoy pero sí ayer: la racha sigue viva', () => {
    const s = summarizeStreak(['2026-10-07', '2026-10-08'], today)
    assert.equal(s.current, 2)
    assert.equal(s.loggedToday, false)
  })

  it('se pasó un día: la racha vuelve a 0 y se conserva el récord', () => {
    const s = summarizeStreak(['2026-10-05', '2026-10-06', '2026-10-07'], today)
    assert.equal(s.current, 0)
    assert.equal(s.best, 3)
  })

  it('un hueco parte la racha: cuenta solo la última tanda', () => {
    const s = summarizeStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-08', '2026-10-09'], today)
    assert.equal(s.current, 2)
    assert.equal(s.best, 3)
  })

  it('ignora duplicados, desorden y valores inválidos', () => {
    const s = summarizeStreak(['2026-10-09', '2026-10-08', '2026-10-08', 'basura', '2026-02-30'], today)
    assert.deepEqual(s, { current: 2, best: 2, loggedToday: true, total: 2 })
  })

  it('un día futuro no cuenta para la racha actual', () => {
    const s = summarizeStreak(['2026-10-12'], today)
    assert.equal(s.current, 0)
  })
})

describe('lastDays', () => {
  const today = '2026-10-09' // viernes

  it('devuelve 7 días, del más viejo al más nuevo, terminando hoy', () => {
    const dots = lastDays([], today)
    assert.equal(dots.length, 7)
    assert.equal(dots[0].day, '2026-10-03')
    assert.equal(dots[6].day, today)
    assert.deepEqual(dots.map((d) => d.isToday), [false, false, false, false, false, false, true])
  })
  it('marca los días con registro y cruza el fin de mes', () => {
    const dots = lastDays(['2026-10-09', '2026-10-07', '2026-09-30', 'basura'], '2026-10-02')
    assert.deepEqual(dots.map((d) => [d.day, d.logged]).filter(([, l]) => l), [['2026-09-30', true]])
    assert.equal(dots[0].day, '2026-09-26')
  })
  it('calcula el día de la semana (0 = domingo)', () => {
    const dots = lastDays([], today)
    assert.equal(dots[6].weekday, 5) // viernes
    assert.equal(dots[0].weekday, 6) // sábado 3
  })
  it('una fecha de hoy inválida no rompe', () => {
    assert.deepEqual(lastDays(['2026-10-09'], 'x'), [])
  })
  it('es coherente con la racha: los días seguidos hasta hoy quedan todos marcados', () => {
    const days = ['2026-10-07', '2026-10-08', '2026-10-09']
    const dots = lastDays(days, today)
    assert.equal(dots.filter((d) => d.logged).length, summarizeStreak(days, today).current)
  })
})
