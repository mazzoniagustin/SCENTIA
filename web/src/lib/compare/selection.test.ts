import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { compareHref, isFull, MAX_COMPARE, parseSelection, removeItem, serializeSelection, toggleItem, type CompareItem } from './selection.ts'

const item = (n: number): CompareItem => ({ id: `id${n}`, brand: `Marca ${n}`, name: `Perfume ${n}` })

describe('toggleItem', () => {
  it('agrega, y al repetir lo quita', () => {
    const a = toggleItem([], item(1))
    assert.deepEqual(a, [item(1)])
    assert.deepEqual(toggleItem(a, item(1)), [])
  })
  it('mantiene la selección entre búsquedas distintas (se acumula)', () => {
    const afterFirstSearch = toggleItem([], item(1)) // YSL Y EDP
    const afterSecondSearch = toggleItem(afterFirstSearch, item(2)) // Odyssey Mega
    assert.deepEqual(afterSecondSearch.map((i) => i.id), ['id1', 'id2'])
  })
  it('no pasa del máximo', () => {
    let items: CompareItem[] = []
    for (let n = 1; n <= MAX_COMPARE + 2; n++) items = toggleItem(items, item(n))
    assert.equal(items.length, MAX_COMPARE)
    assert.equal(isFull(items), true)
    assert.deepEqual(items.map((i) => i.id), ['id1', 'id2', 'id3', 'id4'])
  })
  it('no muta la lista original', () => {
    const original = [item(1)]
    toggleItem(original, item(2))
    assert.equal(original.length, 1)
  })
})

describe('removeItem y compareHref', () => {
  it('quita por id', () => assert.deepEqual(removeItem([item(1), item(2)], 'id1'), [item(2)]))
  it('el enlace exige al menos 2 perfumes', () => {
    assert.equal(compareHref([item(1)]), null)
    assert.equal(compareHref([item(1), item(2)]), '/perfumes/compare?ids=id1,id2')
  })
  it('codifica los ids en la URL', () => {
    assert.equal(compareHref([{ id: 'a b', brand: 'x', name: 'y' }, item(2)]), '/perfumes/compare?ids=a%20b,id2')
  })
})

describe('parseSelection / serializeSelection', () => {
  it('ida y vuelta', () => assert.deepEqual(parseSelection(serializeSelection([item(1), item(2)])), [item(1), item(2)]))
  it('tolera texto vacío, JSON roto y formas incorrectas', () => {
    assert.deepEqual(parseSelection(null), [])
    assert.deepEqual(parseSelection(''), [])
    assert.deepEqual(parseSelection('{no es json'), [])
    assert.deepEqual(parseSelection('{"a":1}'), [])
    assert.deepEqual(parseSelection('[1,"x",null,{"id":5}]'), [])
  })
  it('descarta repetidos, campos inválidos y recorta al máximo (el almacenamiento es manipulable)', () => {
    const many = Array.from({ length: 9 }, (_, n) => item(n + 1))
    assert.equal(parseSelection(JSON.stringify(many)).length, MAX_COMPARE)
    assert.deepEqual(parseSelection(JSON.stringify([item(1), item(1)])), [item(1)])
    assert.deepEqual(parseSelection(JSON.stringify([{ id: 'x'.repeat(65), brand: 'a', name: 'b' }])), [])
    assert.deepEqual(parseSelection(JSON.stringify([{ id: 'ok', brand: '', name: 'b' }])), [])
  })
})
