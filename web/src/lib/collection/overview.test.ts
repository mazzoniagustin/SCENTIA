import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { STATUS_ORDER, STATUS_LABELS, countByStatus, filterByStatus, parseStatusFilter, ratingLabel } from './overview.ts'

const entries = [
  { status: 'OWNED' },
  { status: 'OWNED' },
  { status: 'WISHLIST' },
  { status: 'DISLIKED' },
]

describe('parseStatusFilter', () => {
  it('acepta un estado válido, también como primer valor de un arreglo', () => {
    assert.equal(parseStatusFilter('OWNED'), 'OWNED')
    assert.equal(parseStatusFilter(['WISHLIST', 'OWNED']), 'WISHLIST')
  })

  it('ignora valores inválidos, vacíos o en minúscula', () => {
    assert.equal(parseStatusFilter(undefined), null)
    assert.equal(parseStatusFilter(''), null)
    assert.equal(parseStatusFilter('owned'), null)
    assert.equal(parseStatusFilter('TODOS'), null)
  })
})

describe('countByStatus', () => {
  it('cuenta por estado, con cero para los que no aparecen', () => {
    assert.deepEqual(countByStatus(entries), { OWNED: 2, DECANT: 0, SAMPLED: 0, WISHLIST: 1, DISLIKED: 1 })
  })

  it('una colección vacía da todos en cero', () => {
    assert.deepEqual(countByStatus([]), { OWNED: 0, DECANT: 0, SAMPLED: 0, WISHLIST: 0, DISLIKED: 0 })
  })
})

describe('filterByStatus', () => {
  it('sin filtro devuelve todo y con filtro solo ese estado', () => {
    assert.equal(filterByStatus(entries, null).length, 4)
    assert.equal(filterByStatus(entries, 'OWNED').length, 2)
    assert.equal(filterByStatus(entries, 'SAMPLED').length, 0)
  })
})

describe('etiquetas', () => {
  it('cada estado tiene etiqueta y el orden los cubre a todos', () => {
    assert.deepEqual([...STATUS_ORDER].sort(), Object.keys(STATUS_LABELS).sort())
    assert.equal(STATUS_LABELS.OWNED, 'Lo tengo')
  })

  it('ratingLabel: texto para lectores y null sin puntuación', () => {
    assert.equal(ratingLabel(4), '4 de 5')
    assert.equal(ratingLabel(null), null)
    assert.equal(ratingLabel(undefined), null)
    assert.equal(ratingLabel(0), null)
  })
})
