import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isDayKey, shiftDay, summarizeStreak } from './streak.ts'

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
