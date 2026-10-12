import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseIdList } from './ids.ts'

describe('parseIdList', () => {
  it('ignora vacías, comentarios y espacios, y soporta CRLF', () => {
    const text = '# lote 1\r\nabc\r\n\r\n  def  # nota\n   \n#ghi\nxyz'
    assert.deepEqual(parseIdList(text), ['abc', 'def', 'xyz'])
  })
  it('texto vacío da lista vacía', () => {
    assert.deepEqual(parseIdList(''), [])
  })
})
