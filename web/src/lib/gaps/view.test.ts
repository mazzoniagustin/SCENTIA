import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Finding } from './response.ts'
import { FAMILY_CODES } from './families.ts'
import { announcementFor, familyColor, genderHint, groupFindings, parseRetryAfter, percent, REFINE_EXAMPLES, refineAnnouncement, refineViewFromResponse, valueColor, viewFromResponse } from './view.ts'

test('parseRetryAfter acepta enteros positivos y descarta el resto', () => {
  assert.equal(parseRetryAfter('30'), 30)
  assert.equal(parseRetryAfter(' 12 '), 12)
  assert.equal(parseRetryAfter('0'), 0)
  assert.equal(parseRetryAfter('-5'), 0)
  assert.equal(parseRetryAfter('1.5'), 0)
  assert.equal(parseRetryAfter('abc'), 0)
  assert.equal(parseRetryAfter(null), 0)
  assert.equal(parseRetryAfter('999999'), 3600)
})

test('viewFromResponse mapea códigos HTTP y cuerpos', () => {
  assert.equal(viewFromResponse(401, null, { error: 'x' }).kind, 'unauthorized')
  assert.deepEqual(viewFromResponse(429, '20', null), { kind: 'rate_limited', seconds: 20 })
  assert.deepEqual(viewFromResponse(429, null, null), { kind: 'rate_limited', seconds: 0 })
  assert.equal(viewFromResponse(500, null, { error: 'x' }).kind, 'error')
  assert.equal(viewFromResponse(400, null, null).kind, 'error')
  assert.equal(viewFromResponse(200, null, null).kind, 'error')
  assert.equal(viewFromResponse(200, null, { status: 'raro' }).kind, 'error')
  assert.equal(viewFromResponse(200, null, { status: 'ok', findings: [], families: [], dimensions: [] }).kind, 'ok')
  assert.equal(viewFromResponse(200, null, { status: 'ok' }).kind, 'error')
  assert.equal(viewFromResponse(200, null, { status: 'too_small', guide: { title: 't', text: 'x', links: [] } }).kind, 'guide')
  assert.equal(viewFromResponse(200, null, { status: 'empty', guide: null }).kind, 'error')
})

test('groupFindings separa por tipo conservando el orden', () => {
  const f = (kind: Finding['kind'], code: string): Finding => ({ kind, area: 'family', code, label: code, text: code })
  const g = groupFindings([f('weak', 'a'), f('gap', 'b'), f('unexplored', 'c'), f('gap', 'd')])
  assert.deepEqual(g.gap.map((x) => x.code), ['b', 'd'])
  assert.deepEqual(g.weak.map((x) => x.code), ['a'])
  assert.deepEqual(g.unexplored.map((x) => x.code), ['c'])
})

test('percent redondea y acota', () => {
  assert.equal(percent(0.126), 13)
  assert.equal(percent(-1), 0)
  assert.equal(percent(2), 100)
  assert.equal(percent(Number.NaN), 0)
})

test('announcementFor no anuncia nada en idle y no cuenta segundos', () => {
  assert.equal(announcementFor({ kind: 'idle' }), '')
  assert.ok(!/\d/.test(announcementFor({ kind: 'rate_limited', seconds: 33 })))
})

test('familyColor da un color propio a cada una de las 10 familias y ninguno a lo desconocido', () => {
  const colors = FAMILY_CODES.map((code) => familyColor(code))
  assert.ok(colors.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)), 'todas las familias tienen color')
  assert.equal(new Set(colors).size, FAMILY_CODES.length, 'ninguna repite color')
  assert.equal(familyColor('inventada'), undefined)
})

test('valueColor: estación y día/noche tienen color; duración y estela quedan neutras', () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrastOnDark = (hex: string) => (luminance(hex) + 0.05) / (luminance('#0e0e10') + 0.05)
  const colors = [
    valueColor('season', 'primavera'), valueColor('season', 'verano'), valueColor('season', 'otoño'), valueColor('season', 'invierno'),
    valueColor('dayNight', 'dia'), valueColor('dayNight', 'noche'),
  ]
  assert.ok(colors.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)))
  assert.equal(new Set(colors).size, colors.length)
  assert.equal(valueColor('duration', 'larga'), undefined)
  assert.equal(valueColor('sillage', 'suave'), undefined)
  // La noche, la más oscura, tiene que verse sobre el fondo (≥ 3:1, mínimo de WCAG para gráficos).
  assert.ok(contrastOnDark(valueColor('dayNight', 'noche')!) >= 3)
})

test('genderHint explica qué género se muestra y si lo deducimos o lo eligió la persona', () => {
  const options = [
    { value: 'masculino', label: 'Masculino', includesUnisex: true },
    { value: 'unisex', label: 'Unisex', includesUnisex: false },
    { value: 'femenino', label: 'Femenino', includesUnisex: true },
    { value: 'todos', label: 'Todos', includesUnisex: false },
  ] as const
  const g = (applied: string, chosen: boolean) => ({ applied, inferred: 'masculino', chosen, options: [...options] }) as never
  assert.equal(genderHint(g('masculino', false)), 'Mostramos perfumes masculino y unisex porque es lo que predomina en tu colección. Podés cambiarlo.')
  assert.equal(genderHint(g('femenino', true)), 'Mostrando perfumes femenino y unisex.')
  assert.equal(genderHint(g('unisex', true)), 'Mostrando perfumes unisex.')
  assert.equal(genderHint(g('todos', true)), 'Mostrando perfumes de todos los géneros.')
  assert.equal(genderHint(g('todos', false)), 'Mostrando perfumes de todos los géneros.')
})

test('refineViewFromResponse mapea códigos HTTP y cuerpos', () => {
  assert.equal(refineViewFromResponse(401, null, null).kind, 'unauthorized')
  assert.deepEqual(refineViewFromResponse(429, '15', null), { kind: 'rate_limited', seconds: 15 })
  assert.equal(refineViewFromResponse(503, null, { code: 'disabled' }).kind, 'unavailable')
  assert.equal(refineViewFromResponse(500, null, null).kind, 'error')
  assert.equal(refineViewFromResponse(400, null, { error: 'x' }).kind, 'error')
  assert.equal(refineViewFromResponse(200, null, null).kind, 'error')
  assert.deepEqual(refineViewFromResponse(200, null, { status: 'not_understood', message: 'No entendí' }), { kind: 'not_understood', message: 'No entendí' })
  assert.equal(refineViewFromResponse(200, null, { status: 'not_understood' }).kind, 'error')
  const ok = refineViewFromResponse(200, null, { status: 'ok', summary: 'Busqué…', suggestions: [], complete: false, hadCriteria: true })
  assert.deepEqual(ok, { kind: 'ok', refined: { summary: 'Busqué…', suggestions: [], complete: false, hadCriteria: true } })
  assert.equal(refineViewFromResponse(200, null, { status: 'ok', summary: 5, suggestions: [] }).kind, 'error')
})

test('refineAnnouncement no anuncia nada en idle y cuenta las sugerencias', () => {
  assert.equal(refineAnnouncement({ kind: 'idle' }), '')
  assert.equal(refineAnnouncement({ kind: 'ok', refined: { summary: 's', suggestions: [{}, {}] as never, complete: false, hadCriteria: true } }), 'Listo: 2 sugerencias afinadas.')
  assert.equal(refineAnnouncement({ kind: 'ok', refined: { summary: 's', suggestions: [], complete: false, hadCriteria: true } }), 'No encontramos perfumes con ese pedido.')
  assert.ok(!/\d/.test(refineAnnouncement({ kind: 'rate_limited', seconds: 33 })))
})

test('los ejemplos del cuadro entran en el largo máximo', () => {
  assert.ok(REFINE_EXAMPLES.every((e) => e.length >= 3 && e.length <= 200))
})
