import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isActivePath, NAV_LINKS } from './nav.ts'

describe('isActivePath', () => {
  it('activa en la ruta exacta y en las anidadas', () => {
    assert.equal(isActivePath('/perfumes', '/perfumes'), true)
    assert.equal(isActivePath('/perfumes/abc123', '/perfumes'), true)
    assert.equal(isActivePath('/perfumes/compare', '/perfumes'), true)
    assert.equal(isActivePath('/marcas/Armaf', '/marcas'), true)
    assert.equal(isActivePath('/quiz/resultado', '/quiz'), true)
  })
  it('no confunde prefijos parecidos ni rutas ajenas', () => {
    assert.equal(isActivePath('/perfumesx', '/perfumes'), false)
    assert.equal(isActivePath('/mi-coleccion-vieja', '/mi-coleccion'), false)
    assert.equal(isActivePath('/', '/perfumes'), false)
    assert.equal(isActivePath('/marcas', '/perfumes'), false)
  })
  it('la portada solo es activa en "/"', () => {
    assert.equal(isActivePath('/', '/'), true)
    assert.equal(isActivePath('/perfumes', '/'), false)
  })
  it('a lo sumo un enlace del menú está activo en cada página', () => {
    for (const path of ['/', '/perfumes', '/perfumes/x', '/marcas/Dior', '/quiz', '/mi-coleccion', '/account', '/creditos']) {
      assert.ok(NAV_LINKS.filter((l) => isActivePath(path, l.href)).length <= 1, path)
    }
  })
})
