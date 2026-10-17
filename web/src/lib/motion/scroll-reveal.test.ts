import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decideScrollReveal } from './scroll-reveal.ts'

const VIEWPORT = 800

test('sin posibilidad de animar queda estático, esté donde esté', () => {
  assert.equal(decideScrollReveal({ canAnimate: false, rect: { top: 100, bottom: 140 }, viewportHeight: VIEWPORT }), 'static')
  assert.equal(decideScrollReveal({ canAnimate: false, rect: { top: 2000, bottom: 2040 }, viewportHeight: VIEWPORT }), 'static')
})

test('si ya se ve en la ventana conserva la entrada por tiempo (initial)', () => {
  assert.equal(decideScrollReveal({ canAnimate: true, rect: { top: 100, bottom: 140 }, viewportHeight: VIEWPORT }), 'initial')
  assert.equal(decideScrollReveal({ canAnimate: true, rect: { top: 780, bottom: 900 }, viewportHeight: VIEWPORT }), 'initial')
  assert.equal(decideScrollReveal({ canAnimate: true, rect: { top: -20, bottom: 20 }, viewportHeight: VIEWPORT }), 'initial')
})

test('si está fuera de la ventana espera a aparecer (pending)', () => {
  assert.equal(decideScrollReveal({ canAnimate: true, rect: { top: 800, bottom: 840 }, viewportHeight: VIEWPORT }), 'pending')
  assert.equal(decideScrollReveal({ canAnimate: true, rect: { top: 2000, bottom: 2040 }, viewportHeight: VIEWPORT }), 'pending')
  assert.equal(decideScrollReveal({ canAnimate: true, rect: { top: -300, bottom: -10 }, viewportHeight: VIEWPORT }), 'pending')
})
