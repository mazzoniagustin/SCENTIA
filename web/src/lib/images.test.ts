import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { imageFieldsFromRecord, isAllowedImageUrl, isAllowedSourcePageUrl } from './images.ts'

describe('isAllowedImageUrl', () => {
  it('acepta https del host permitido', () => {
    assert.equal(isAllowedImageUrl('https://fimgs.net/mdimg/perfume/375x500.9828.jpg'), true)
  })
  it('rechaza http, otros hosts y subdominios o dominios parecidos', () => {
    assert.equal(isAllowedImageUrl('http://fimgs.net/a.jpg'), false)
    assert.equal(isAllowedImageUrl('https://evil.com/a.jpg'), false)
    assert.equal(isAllowedImageUrl('https://fimgs.net.evil.com/a.jpg'), false)
    assert.equal(isAllowedImageUrl('https://evilfimgs.net/a.jpg'), false)
    assert.equal(isAllowedImageUrl('https://cdn.fimgs.net/a.jpg'), false)
  })
  it('rechaza usuario/clave, puerto, esquemas raros y valores que no son texto', () => {
    assert.equal(isAllowedImageUrl('https://user:pw@fimgs.net/a.jpg'), false)
    assert.equal(isAllowedImageUrl('https://fimgs.net:8443/a.jpg'), false)
    assert.equal(isAllowedImageUrl('javascript:alert(1)'), false)
    assert.equal(isAllowedImageUrl('data:image/png;base64,AAAA'), false)
    assert.equal(isAllowedImageUrl('//fimgs.net/a.jpg'), false)
    assert.equal(isAllowedImageUrl(''), false)
    assert.equal(isAllowedImageUrl(null), false)
    assert.equal(isAllowedImageUrl(42), false)
  })
  it('rechaza URLs larguísimas', () => {
    assert.equal(isAllowedImageUrl(`https://fimgs.net/${'a'.repeat(600)}.jpg`), false)
  })
})

describe('isAllowedSourcePageUrl', () => {
  it('solo https de la página de la fuente', () => {
    assert.equal(isAllowedSourcePageUrl('https://www.fragrantica.com/perfume/Creed/Aventus-9828.html'), true)
    assert.equal(isAllowedSourcePageUrl('https://fragrantica.com/x'), false)
    assert.equal(isAllowedSourcePageUrl('http://www.fragrantica.com/x'), false)
  })
})

describe('imageFieldsFromRecord', () => {
  const picture = 'https://fimgs.net/mdimg/perfume/375x500.9828.jpg'
  const url = 'https://www.fragrantica.com/perfume/Creed/Aventus-9828.html'
  it('arma los tres campos', () => {
    assert.deepEqual(imageFieldsFromRecord({ picture, url }), { imageUrl: picture, imageSource: 'Fragrantica', imageSourceUrl: url })
  })
  it('sin página válida igual guarda la imagen, con crédito sin enlace', () => {
    assert.deepEqual(imageFieldsFromRecord({ picture, url: 'https://evil.com/x' }), { imageUrl: picture, imageSource: 'Fragrantica', imageSourceUrl: null })
  })
  it('sin imagen válida no devuelve nada', () => {
    assert.equal(imageFieldsFromRecord({ picture: 'https://evil.com/a.jpg', url }), null)
    assert.equal(imageFieldsFromRecord({ url }), null)
  })
})
