import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { OWN_ACCORD_WHERE, OWN_PERFUME_WHERE, RESTORE_ORDER, selectionFor, USER_DATA_TABLES } from './backup-plan.ts'

const before = (a: string, b: string) => RESTORE_ORDER.indexOf(a) < RESTORE_ORDER.indexOf(b)

describe('RESTORE_ORDER', () => {
  it('restaura User antes que Perfume (Perfume.ownerId tiene FK a User)', () => {
    assert.ok(before('User', 'Perfume'))
  })

  it('respeta el resto de las claves foráneas', () => {
    for (const [parent, child] of [['Accord', 'PerfumeAccord'], ['Note', 'PerfumeNote'], ['Perfume', 'PerfumeAccord'], ['Perfume', 'PerfumeNote'], ['Perfume', 'UserCollection'], ['User', 'UserCollection'], ['User', 'UserProfile'], ['User', 'CollectionShare']]) {
      assert.ok(before(parent, child), `${parent} antes que ${child}`)
    }
  })

  it('incluye CollectionShare, después de User', () => {
    assert.ok(RESTORE_ORDER.includes('CollectionShare'))
    assert.ok(before('User', 'CollectionShare'))
    assert.ok(USER_DATA_TABLES.includes('CollectionShare'))
  })

  it('no repite tablas', () => {
    assert.equal(new Set(RESTORE_ORDER).size, RESTORE_ORDER.length)
  })
})

describe('selectionFor', () => {
  const all = ['Accord', 'Note', 'Perfume', 'PerfumeAccord', 'PerfumeNote', 'User', 'UserCollection', 'UserProfile', 'CollectionShare', 'WearLog']

  it('respaldo completo: todas las tablas, sin filtro', () => {
    assert.deepEqual(selectionFor(all, false), all.map((table) => ({ table, where: '' })))
  })

  it('respaldo de datos de personas: incluye los perfumes propios y sus acordes, y no el catálogo', () => {
    const selection = selectionFor(all, true)
    const tables = selection.map((s) => s.table)
    for (const table of USER_DATA_TABLES) assert.ok(tables.includes(table), table)
    assert.deepEqual(selection.find((s) => s.table === 'Perfume'), { table: 'Perfume', where: OWN_PERFUME_WHERE })
    assert.deepEqual(selection.find((s) => s.table === 'PerfumeAccord'), { table: 'PerfumeAccord', where: OWN_ACCORD_WHERE })
    for (const table of ['Accord', 'Note', 'PerfumeNote', 'WearLog']) assert.ok(!tables.includes(table), `${table} no va en el respaldo de usuarios`)
    assert.match(OWN_PERFUME_WHERE, /"ownerId" IS NOT NULL/)
  })

  it('ignora tablas que no existen en la base', () => {
    assert.deepEqual(selectionFor(['User'], true).map((s) => s.table), ['User'])
  })
})
