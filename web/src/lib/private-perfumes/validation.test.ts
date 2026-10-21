import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseNoteList, privatePerfumeInputFromFormData, validatePrivatePerfume } from './validation.ts'

const ok = (input: unknown) => {
  const result = validatePrivatePerfume(input)
  assert.equal(result.ok, true, JSON.stringify(result))
  return (result as { ok: true; value: Record<string, unknown> }).value
}
const error = (input: unknown) => {
  const result = validatePrivatePerfume(input)
  assert.equal(result.ok, false)
  return (result as { ok: false; error: string }).error
}

describe('validatePrivatePerfume', () => {
  it('acepta solo el nombre y completa los valores por defecto', () => {
    assert.deepEqual(ok({ name: 'Mi perfume' }), {
      name: 'Mi perfume', brand: '', perfumer: null, gender: 'unisex', description: null,
      topNotes: [], heartNotes: [], baseNotes: [], accordIds: [], longevity: null, sillage: null,
    })
  })

  it('recorta el nombre y rechaza vacío, solo espacios, 1 carácter y más de 80', () => {
    assert.equal(ok({ name: '  Oud Noir  ' }).name, 'Oud Noir')
    for (const name of ['', ' ', '   ', 'a', ' a ', 'x'.repeat(81)]) assert.match(error({ name }), /nombre/i)
    assert.equal(ok({ name: 'x'.repeat(80) }).name, 'x'.repeat(80))
    assert.match(error({ name: 42 }), /nombre/i)
    assert.match(error({}), /nombre/i)
  })

  it('valida el género contra los del catálogo', () => {
    for (const gender of ['masculino', 'femenino', 'unisex']) assert.equal(ok({ name: 'Ab', gender }).gender, gender)
    assert.match(error({ name: 'Ab', gender: 'otro' }), /género/i)
    assert.equal(ok({ name: 'Ab', gender: '' }).gender, 'unisex')
  })

  it('admite hasta 6 acordes sin repetir', () => {
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
    assert.deepEqual(ok({ name: 'Ab', accordIds: ids }).accordIds, ids)
    assert.match(error({ name: 'Ab', accordIds: [...ids, 'a7'] }), /acordes/i)
    assert.deepEqual(ok({ name: 'Ab', accordIds: ['a1', 'a1', 'a2'] }).accordIds, ['a1', 'a2'])
    assert.match(error({ name: 'Ab', accordIds: 'a1' }), /acordes/i)
    assert.match(error({ name: 'Ab', accordIds: [1] }), /acordes/i)
  })

  it('acepta duración de 1 a 5 y estela de 1 a 4', () => {
    for (const n of [1, 5]) assert.equal(ok({ name: 'Ab', longevity: n }).longevity, n)
    for (const n of [0, 6, 2.5, '3']) assert.match(error({ name: 'Ab', longevity: n }), /duración/i)
    for (const n of [1, 4]) assert.equal(ok({ name: 'Ab', sillage: n }).sillage, n)
    for (const n of [0, 5, 1.5]) assert.match(error({ name: 'Ab', sillage: n }), /estela/i)
  })

  it('normaliza las notas y limita su cantidad y largo', () => {
    assert.deepEqual(ok({ name: 'Ab', topNotes: ['Limón', ' limón ', '', 'Bergamota'] }).topNotes, ['Limón', 'Bergamota'])
    assert.match(error({ name: 'Ab', heartNotes: Array.from({ length: 16 }, (_, i) => `nota ${i}`) }), /notas/i)
    assert.match(error({ name: 'Ab', baseNotes: ['x'.repeat(41)] }), /notas/i)
    assert.match(error({ name: 'Ab', topNotes: 'limón' }), /notas/i)
  })

  it('limita perfumista y descripción', () => {
    assert.equal(ok({ name: 'Ab', perfumer: '  Alberto Morillas ' }).perfumer, 'Alberto Morillas')
    assert.equal(ok({ name: 'Ab', perfumer: '  ' }).perfumer, null)
    assert.match(error({ name: 'Ab', perfumer: 'x'.repeat(101) }), /perfumista/i)
    assert.equal(ok({ name: 'Ab', description: 'x'.repeat(500) }).description, 'x'.repeat(500))
    assert.match(error({ name: 'Ab', description: 'x'.repeat(501) }), /descripción/i)
  })

  it('rechaza una marca de más de 80 caracteres', () => {
    assert.equal(ok({ name: 'Ab', brand: ' Dior ' }).brand, 'Dior')
    assert.match(error({ name: 'Ab', brand: 'x'.repeat(81) }), /marca/i)
  })

  it('rechaza entradas que no son un objeto', () => {
    for (const input of [null, undefined, [], 'texto', 5]) assert.equal(error(input), 'datos inválidos')
  })
})

describe('parseNoteList', () => {
  it('separa por comas, recorta y quita vacías y repetidas sin distinguir mayúsculas', () => {
    assert.deepEqual(parseNoteList('Vainilla, vainilla ,, Ámbar'), ['Vainilla', 'Ámbar'])
    assert.deepEqual(parseNoteList(''), [])
    assert.deepEqual(parseNoteList(' , , '), [])
  })
})

describe('privatePerfumeInputFromFormData', () => {
  it('lee los campos del formulario como entrada cruda', () => {
    const form = new FormData()
    form.set('name', 'Mi perfume')
    form.set('topNotes', 'Limón, Bergamota')
    form.append('accordIds', 'a1')
    form.append('accordIds', 'a2')
    form.set('longevity', '4')
    form.set('sillage', '')
    const raw = privatePerfumeInputFromFormData(form)
    assert.equal(raw.name, 'Mi perfume')
    assert.deepEqual(raw.topNotes, ['Limón', 'Bergamota'])
    assert.deepEqual(raw.accordIds, ['a1', 'a2'])
    assert.equal(raw.longevity, 4)
    assert.equal(raw.sillage, undefined)
    assert.deepEqual(ok(raw).topNotes, ['Limón', 'Bergamota'])
  })

  it('deja pasar un valor no numérico para que la validación lo rechace', () => {
    const form = new FormData()
    form.set('name', 'Ab')
    form.set('longevity', 'mucho')
    assert.match(error(privatePerfumeInputFromFormData(form)), /duración/i)
  })
})
