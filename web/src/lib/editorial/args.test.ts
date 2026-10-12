import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { checkIdLimit, MAX_IDS_PER_RUN, parseArgs, uniqueIds } from './args.ts'

describe('parseArgs', () => {
  it('exige un subcomando válido', () => {
    assert.equal(parseArgs([]).ok, false)
    assert.equal(parseArgs(['borrar']).ok, false)
  })
  it('list con valores en ambas formas', () => {
    const r = parseArgs(['list', '--status', 'draft', '--limit=10', '--q', 'dior'])
    assert.deepEqual(r, { ok: true, command: { kind: 'list', status: 'DRAFT', limit: 10, q: 'dior' } })
  })
  it('list rechaza estado, límite y opciones inválidos', () => {
    assert.equal(parseArgs(['list', '--status', 'x']).ok, false)
    assert.equal(parseArgs(['list', '--limit', '0']).ok, false)
    assert.equal(parseArgs(['list', '--limit', 'abc']).ok, false)
    assert.equal(parseArgs(['list', '--apply']).ok, false)
    assert.equal(parseArgs(['list', '--q']).ok, false)
  })
  it('publish toma ids, --apply y --force-large', () => {
    const r = parseArgs(['publish', 'a', 'b', '--apply', '--force-large'])
    assert.deepEqual(r, { ok: true, command: { kind: 'publish', ids: ['a', 'b'], file: null, apply: true, forceLarge: true } })
  })
  it('simulación por defecto y --file', () => {
    const r = parseArgs(['unpublish', '--file', 'ids.txt'])
    assert.deepEqual(r, { ok: true, command: { kind: 'unpublish', ids: [], file: 'ids.txt', apply: false, forceLarge: false } })
  })
  it('publish sin ids ni archivo falla', () => {
    assert.equal(parseArgs(['publish', '--apply']).ok, false)
    assert.equal(parseArgs(['publish', '--file']).ok, false)
    assert.equal(parseArgs(['publish', 'a', '--nope']).ok, false)
  })
})

describe('uniqueIds y checkIdLimit', () => {
  it('quita duplicados conservando el orden', () => {
    assert.deepEqual(uniqueIds(['b', 'a', 'b']), ['b', 'a'])
  })
  it('respeta el tope salvo --force-large', () => {
    assert.equal(checkIdLimit(MAX_IDS_PER_RUN, false), null)
    assert.notEqual(checkIdLimit(MAX_IDS_PER_RUN + 1, false), null)
    assert.equal(checkIdLimit(MAX_IDS_PER_RUN + 1, true), null)
  })
})
