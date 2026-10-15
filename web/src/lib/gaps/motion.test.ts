import assert from 'node:assert/strict'
import { test } from 'node:test'

import { clamp01, countAt, easeOutCubic, splitWords, staggerProgress, staggerTotalMs, tiltFor } from './motion.ts'

test('easeOutCubic va de 0 a 1 y no se pasa', () => {
  assert.equal(easeOutCubic(0), 0)
  assert.equal(easeOutCubic(1), 1)
  assert.equal(easeOutCubic(-3), 0)
  assert.equal(easeOutCubic(7), 1)
  assert.ok(easeOutCubic(0.5) > 0.5)
  assert.equal(easeOutCubic(Number.NaN), 0)
})

test('clamp01 acota y tolera valores raros', () => {
  assert.equal(clamp01(0.4), 0.4)
  assert.equal(clamp01(Number.POSITIVE_INFINITY), 0)
  assert.equal(clamp01(-1), 0)
})

test('staggerProgress escalona las filas y con tiempo infinito deja todo completo', () => {
  assert.equal(staggerProgress(0, 0, 80, 900), 0)
  assert.equal(staggerProgress(900, 0, 80, 900), 1)
  // La fila 3 arranca a los 240 ms: antes no avanzó.
  assert.equal(staggerProgress(240, 3, 80, 900), 0)
  assert.ok(staggerProgress(600, 3, 80, 900) > 0)
  assert.ok(staggerProgress(600, 3, 80, 900) < staggerProgress(600, 0, 80, 900))
  assert.equal(staggerProgress(Number.POSITIVE_INFINITY, 9, 80, 900), 1)
  assert.equal(staggerProgress(Number.NaN, 0, 80, 900), 0)
  assert.equal(staggerProgress(500, 0, 80, 0), 0)
})

test('staggerTotalMs suma el escalonado y la duración', () => {
  assert.equal(staggerTotalMs(1, 80, 900), 900)
  assert.equal(staggerTotalMs(5, 80, 900), 1220)
  assert.equal(staggerTotalMs(0, 80, 900), 900)
})

test('countAt cuenta con enteros, nunca pasa del valor final y llega justo a él', () => {
  assert.equal(countAt(5, 0), 0)
  assert.equal(countAt(5, 1), 5)
  assert.equal(countAt(5, 2), 5)
  assert.equal(countAt(33, 0.5), 17)
  assert.equal(countAt(0, 0.7), 0)
  assert.equal(countAt(-4, 0.7), 0)
  assert.equal(countAt(Number.NaN, 0.7), 0)
  for (let p = 0; p <= 1; p += 0.05) assert.ok(Number.isInteger(countAt(47, p)))
})

test('tiltFor: el centro no inclina y los bordes llegan al máximo', () => {
  const center = tiltFor(100, 50, 200, 100)
  assert.deepEqual(center, { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 })
  const corner = tiltFor(200, 0, 200, 100, 6)
  assert.equal(corner.rotateY, 6)
  assert.equal(corner.rotateX, 6)
  const other = tiltFor(0, 100, 200, 100, 6)
  assert.equal(other.rotateY, -6)
  assert.equal(other.rotateX, -6)
})

test('tiltFor acota el cursor fuera de la tarjeta y tolera tamaño nulo', () => {
  assert.equal(tiltFor(9999, 9999, 200, 100, 6).rotateY, 6)
  assert.equal(tiltFor(-50, -50, 200, 100, 6).glowX, 0)
  assert.deepEqual(tiltFor(10, 10, 0, 0), { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 })
})

test('splitWords separa por espacios sin dejar vacíos', () => {
  assert.deepEqual(splitWords('Lo que  menos exploraste: «Floral».'), ['Lo', 'que', 'menos', 'exploraste:', '«Floral».'])
  assert.deepEqual(splitWords('   '), [])
})
