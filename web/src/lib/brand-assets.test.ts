import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BRAND_ASSETS, getBrandAsset, isBrandSrc, isSvg, type BrandSlot } from './brand-assets.ts'

test('todos los slots apuntan a /brand/, con tamaño positivo y texto alternativo definido', () => {
  for (const [slot, asset] of Object.entries(BRAND_ASSETS)) {
    assert.ok(isBrandSrc(asset.src), `${slot}: ruta inválida ${asset.src}`)
    assert.ok(asset.width > 0 && asset.height > 0, `${slot}: tamaño`)
    assert.equal(typeof asset.alt, 'string')
  }
})

test('el logo y la imagen para compartir (con significado) tienen texto alternativo', () => {
  assert.notEqual(BRAND_ASSETS.logo.alt, '')
  assert.notEqual(BRAND_ASSETS.ogImage.alt, '')
})

test('un slot apagado no devuelve nada; uno encendido sí', () => {
  const off = { ...BRAND_ASSETS, logo: { ...BRAND_ASSETS.logo, available: false } }
  assert.equal(getBrandAsset('logo', off), null)
  const on = { ...BRAND_ASSETS, logo: { ...BRAND_ASSETS.logo, available: true } }
  assert.equal(getBrandAsset('logo', on)?.src, '/brand/logo.svg')
})

test('una ruta fuera de /brand/ se descarta aunque el slot esté encendido', () => {
  const bad = { ...BRAND_ASSETS, hero: { ...BRAND_ASSETS.hero, src: 'https://otro.com/x.jpg', available: true } }
  assert.equal(getBrandAsset('hero', bad), null)
  for (const src of ['/brand/../.env', '/otra/x.png', '//evil.com/x.png', '/brand/', '/brand/a/b.png']) {
    assert.equal(isBrandSrc(src), false, src)
  }
  assert.equal(isBrandSrc('/brand/logo.svg'), true)
})

test('un slot desconocido no rompe', () => {
  assert.equal(getBrandAsset('nope' as BrandSlot), null)
})

test('isSvg distingue vectoriales', () => {
  assert.equal(isSvg('/brand/logo.svg'), true)
  assert.equal(isSvg('/brand/hero.JPG'), false)
})
