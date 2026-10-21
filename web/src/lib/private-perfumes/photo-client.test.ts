import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCEPT_ATTRIBUTE, acceptPhotoFile, fitWithin, MAX_INPUT_BYTES, MAX_SIDE } from './photo-client.ts'

describe('fitWithin', () => {
  it('achica al lado mayor máximo conservando la proporción', () => {
    assert.deepEqual(fitWithin(4000, 3000, 800), { width: 800, height: 600 })
    assert.deepEqual(fitWithin(3000, 4000, 800), { width: 600, height: 800 })
    assert.deepEqual(fitWithin(1000, 1000, 800), { width: 800, height: 800 })
  })

  it('no agranda una imagen que ya entra', () => {
    assert.deepEqual(fitWithin(600, 400, 800), { width: 600, height: 400 })
    assert.deepEqual(fitWithin(800, 800, 800), { width: 800, height: 800 })
  })

  it('nunca devuelve una dimensión menor a 1 píxel', () => {
    assert.deepEqual(fitWithin(10000, 3, 800), { width: 800, height: 1 })
  })

  it('rechaza dimensiones que no son positivas', () => {
    for (const [w, h] of [[0, 100], [100, 0], [-1, 5], [Number.NaN, 5]]) assert.throws(() => fitWithin(w, h, 800), /dimensiones/i)
  })

  it('usa 800 px como lado mayor del spec', () => {
    assert.equal(MAX_SIDE, 800)
  })
})

describe('ACCEPT_ATTRIBUTE', () => {
  it('no pide HEIC para que el teléfono convierta la foto a JPEG', () => {
    assert.ok(!/hei[cf]/.test(ACCEPT_ATTRIBUTE))
    assert.ok(ACCEPT_ATTRIBUTE.includes('image/jpeg'))
  })
})

describe('acceptPhotoFile', () => {
  const file = (type: string, size: number) => ({ type, size })

  it('acepta cualquier imagen (también HEIC o sin tipo, como informan algunos teléfonos) dentro del tope de entrada', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif', 'IMAGE/JPEG', '']) assert.deepEqual(acceptPhotoFile(file(type, 1000)), { ok: true })
    assert.deepEqual(acceptPhotoFile(file('image/jpeg', MAX_INPUT_BYTES)), { ok: true })
  })

  it('rechaza lo que no es una foto', () => {
    for (const type of ['application/pdf', 'text/plain', 'video/mp4', 'image/svg+xml']) assert.equal(acceptPhotoFile(file(type, 1000)).ok, false, type)
  })

  it('rechaza un archivo vacío o de más de 10 MB', () => {
    assert.equal(acceptPhotoFile(file('image/jpeg', 0)).ok, false)
    assert.equal(acceptPhotoFile(file('image/jpeg', MAX_INPUT_BYTES + 1)).ok, false)
    assert.equal(MAX_INPUT_BYTES, 10 * 1024 * 1024)
  })
})
