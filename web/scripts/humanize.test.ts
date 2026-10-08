// Ejecutar con: npx tsx --test scripts/humanize.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { humanize, humanizeBrand, humanizePerfumers, humanizePerson, parseConcentration } from './humanize.ts'

describe('humanizePerson', () => {
  it('capitaliza nombres y conserva acentos', () => {
    assert.equal(humanizePerson('jean françois latty'), 'Jean François Latty')
    assert.equal(humanizePerson('sophie labbé'), 'Sophie Labbé')
  })
  it('capitaliza cada parte de un nombre compuesto', () => {
    assert.equal(humanizePerson('pierre-constantin guéros'), 'Pierre-Constantin Guéros')
    assert.equal(humanizePerson("dominique d'ascanio"), "Dominique D'Ascanio")
  })
  it('deja las partículas en minúscula salvo al inicio', () => {
    assert.equal(humanizePerson('olivier de la fontaine'), 'Olivier de la Fontaine')
    assert.equal(humanizePerson('de la rosa'), 'De la Rosa')
  })
  it('tolera espacios sobrantes y vacío', () => {
    assert.equal(humanizePerson('  ana   gil  '), 'Ana Gil')
    assert.equal(humanizePerson(''), '')
  })
})

describe('humanizePerfumers', () => {
  it('humaniza una lista separada por comas', () => {
    assert.equal(humanizePerfumers('sophie labbé, mário torri neto'), 'Sophie Labbé, Mário Torri Neto')
  })
})

describe('humanize (marcas y nombres)', () => {
  it('casos conocidos', () => {
    assert.equal(humanizeBrand('victoria-s-secret'), "Victoria's Secret")
    assert.equal(humanizeBrand('l-occitane-en-provence'), "L'Occitane en Provence")
    assert.equal(humanizeBrand('dolce-gabbana'), 'Dolce & Gabbana')
    assert.equal(humanize('flower-by-cynthia-rowley-edp'), 'Flower by Cynthia Rowley EDP')
  })
})

describe('parseConcentration', () => {
  it('detecta formas explícitas y no un "parfum" suelto', () => {
    assert.equal(parseConcentration('boss-alive-eau-de-toilette'), 'edt')
    assert.equal(parseConcentration('cashmere-mist-edp'), 'edp')
    assert.equal(parseConcentration('gaultier-divine-le-parfum'), null)
    assert.equal(parseConcentration('cologne-de-la-terre'), null)
  })
})
