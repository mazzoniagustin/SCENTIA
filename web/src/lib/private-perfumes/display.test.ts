import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { brandAndName, brandInParens, nameOfBrand, perfumeHref } from './display.ts'

describe('perfumeHref', () => {
  it('un perfume propio va a su ficha privada y uno del catálogo a la pública', () => {
    assert.equal(perfumeHref({ perfumeId: 'p1', own: true }), '/mi-coleccion/p1')
    assert.equal(perfumeHref({ perfumeId: 'p1', own: false }), '/perfumes/p1')
    assert.equal(perfumeHref({ perfumeId: 'p1' }), '/perfumes/p1')
  })
})

describe('marca opcional', () => {
  it('brandAndName omite la marca vacía sin dejar espacios de más', () => {
    assert.equal(brandAndName('Dior', 'Sauvage'), 'Dior Sauvage')
    for (const brand of ['', ' ', '   ']) assert.equal(brandAndName(brand, 'Mi perfume'), 'Mi perfume')
  })

  it('nameOfBrand arma "Nombre de Marca" solo si hay marca', () => {
    assert.equal(nameOfBrand('Sauvage', 'Dior'), 'Sauvage de Dior')
    for (const brand of ['', '  ']) assert.equal(nameOfBrand('Mi perfume', brand), 'Mi perfume')
  })

  it('brandInParens devuelve la marca entre paréntesis o nada', () => {
    assert.equal(brandInParens('Dior'), '(Dior)')
    for (const brand of ['', '  ']) assert.equal(brandInParens(brand), '')
  })
})
