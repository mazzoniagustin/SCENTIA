import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ACCORD_TRANSLATIONS } from '../../scripts/accord-translations.ts'
import { coverColors, dominantAccord, hueForAccord, initialsOf } from './cover.ts'

const acc = (name: string, intensity: number) => ({ intensity, accord: { name } })

describe('portada generada', () => {
  it('elige el acorde de mayor intensidad', () => {
    assert.equal(dominantAccord([acc('dulce', 60), acc('vainilla', 100), acc('floral', 80)]), 'vainilla')
  })

  it('desempata por nombre, sin depender del orden de entrada', () => {
    assert.equal(dominantAccord([acc('rosa', 50), acc('ámbar', 50)]), 'ámbar')
    assert.equal(dominantAccord([acc('ámbar', 50), acc('rosa', 50)]), 'ámbar')
  })

  it('sin acordes devuelve null y colores neutros', () => {
    assert.equal(dominantAccord([]), null)
    assert.equal(dominantAccord(undefined), null)
    assert.equal(coverColors([]).accord, null)
  })

  it('agrupa acordes por familia y marca los desconocidos', () => {
    assert.equal(hueForAccord('Cítrico').known, true)
    assert.equal(hueForAccord('cinta adhesiva marrón').known, false)
    assert.equal(hueForAccord('marino').hue, hueForAccord('acuático').hue)
  })

  it('al menos el 70 % de los acordes tienen familia (el resto son raros: plástico, gasolina…)', () => {
    const names = Object.values(ACCORD_TRANSLATIONS)
    const known = names.filter((n) => hueForAccord(n).known).length
    assert.ok(known / names.length >= 0.7, `solo ${known}/${names.length}`)
  })

  it('es determinista', () => {
    assert.deepEqual(coverColors([acc('amaderado', 100)]), coverColors([acc('amaderado', 100)]))
  })
})

describe('monograma de la portada', () => {
  it('toma las dos primeras palabras significativas', () => {
    assert.equal(initialsOf('Bleu de Chanel'), 'BC')
    assert.equal(initialsOf('Amber Queen'), 'AQ')
  })
  it('ignora números y conectores', () => {
    assert.equal(initialsOf('Wd 18'), 'W')
    assert.equal(initialsOf('Sn 2020'), 'S')
    assert.equal(initialsOf('Out In the Open'), 'OO')
  })
  it('maneja acentos, apóstrofes y nombres solo numéricos', () => {
    assert.equal(initialsOf('Hypnôse'), 'H')
    assert.equal(initialsOf("L'Eau d'Issey"), 'LE')
    assert.equal(initialsOf('212'), '2')
  })
})
