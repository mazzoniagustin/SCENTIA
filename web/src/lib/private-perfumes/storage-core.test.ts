import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { listFolderPaths, LIST_PAGE_SIZE, photoExistsIn, removePhotosFrom, signPhotoUrlsWith, SIGNED_URL_SECONDS, type PhotoBucket } from './storage-core.ts'

const bucket = (overrides: Partial<PhotoBucket> = {}): PhotoBucket => ({
  createSignedUploadUrl: async () => ({ data: null, error: new Error('no') }),
  createSignedUrls: async () => ({ data: [], error: null }),
  list: async () => ({ data: [], error: null }),
  remove: async () => ({ data: null, error: null }),
  ...overrides,
})

describe('signPhotoUrlsWith', () => {
  it('devuelve ruta → URL firmada y omite las que fallan', async () => {
    let seen: { paths: string[]; seconds: number } | null = null
    const result = await signPhotoUrlsWith(
      bucket({
        createSignedUrls: async (paths, seconds) => {
          seen = { paths, seconds }
          return {
            data: [
              { path: 'a/1.webp', signedUrl: 'https://x/1', error: null },
              { path: 'a/2.webp', signedUrl: '', error: 'Object not found' },
            ],
            error: null,
          }
        },
      }),
      ['a/1.webp', 'a/2.webp'],
    )
    assert.deepEqual([...result], [['a/1.webp', 'https://x/1']])
    assert.deepEqual(seen, { paths: ['a/1.webp', 'a/2.webp'], seconds: SIGNED_URL_SECONDS })
    assert.equal(SIGNED_URL_SECONDS, 3600)
  })

  it('no llama a Storage sin rutas y no lanza si Storage falla', async () => {
    let calls = 0
    const counting = bucket({ createSignedUrls: async () => { calls++; return { data: null, error: new Error('caído') } } })
    assert.equal((await signPhotoUrlsWith(counting, [])).size, 0)
    assert.equal(calls, 0)
    assert.equal((await signPhotoUrlsWith(counting, ['a/1.webp'])).size, 0)
    const throwing = bucket({ createSignedUrls: async () => { throw new Error('red') } })
    assert.equal((await signPhotoUrlsWith(throwing, ['a/1.webp'])).size, 0)
  })

  it('quita rutas repetidas antes de pedir la firma', async () => {
    let asked: string[] = []
    await signPhotoUrlsWith(bucket({ createSignedUrls: async (paths) => { asked = paths; return { data: [], error: null } } }), ['a/1.webp', 'a/1.webp'])
    assert.deepEqual(asked, ['a/1.webp'])
  })
})

describe('photoExistsIn', () => {
  it('busca el archivo en su carpeta y devuelve su tamaño', async () => {
    let listed: { folder: string; search: string } | null = null
    const result = await photoExistsIn(
      bucket({
        list: async (folder, options) => {
          listed = { folder, search: options.search ?? '' }
          return { data: [{ name: 'p1.webp', metadata: { size: 1234 } }, { name: 'p1.webp.bak', metadata: { size: 9 } }], error: null }
        },
      }),
      'abc/p1.webp',
    )
    assert.deepEqual(listed, { folder: 'abc', search: 'p1.webp' })
    assert.deepEqual(result, { exists: true, bytes: 1234 })
  })

  it('devuelve exists:false si no está o si Storage falla', async () => {
    assert.deepEqual(await photoExistsIn(bucket(), 'abc/p1.webp'), { exists: false, bytes: 0 })
    const failing = bucket({ list: async () => ({ data: null, error: new Error('x') }) })
    assert.deepEqual(await photoExistsIn(failing, 'abc/p1.webp'), { exists: false, bytes: 0 })
  })
})

describe('removePhotosFrom', () => {
  it('no llama a Storage sin rutas', async () => {
    let calls = 0
    await removePhotosFrom(bucket({ remove: async () => { calls++; return { data: null, error: null } } }), [])
    assert.equal(calls, 0)
  })

  it('borra las rutas pedidas y devuelve si salió bien', async () => {
    let removed: string[] = []
    assert.equal(await removePhotosFrom(bucket({ remove: async (paths) => { removed = paths; return { data: null, error: null } } }), ['a/1.webp', 'a/2.webp']), true)
    assert.deepEqual(removed, ['a/1.webp', 'a/2.webp'])
    assert.equal(await removePhotosFrom(bucket({ remove: async () => ({ data: null, error: new Error('x') }) }), ['a/1.webp']), false)
  })
})

describe('listFolderPaths', () => {
  const files = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ name: `f${from + i}.webp`, metadata: { size: 10 } }))

  it('devuelve las rutas completas de todos los archivos de la carpeta, página por página', async () => {
    const total = LIST_PAGE_SIZE * 2 + 5
    const everything = files(total)
    const calls: Array<{ folder: string; offset: number | undefined }> = []
    const result = await listFolderPaths(
      bucket({
        list: async (folder, options) => {
          calls.push({ folder, offset: options.offset })
          const offset = options.offset ?? 0
          return { data: everything.slice(offset, offset + options.limit), error: null }
        },
      }),
      'abc',
    )
    assert.equal(result.length, total)
    assert.equal(result[0], 'abc/f0.webp')
    assert.equal(result[total - 1], `abc/f${total - 1}.webp`)
    assert.deepEqual(calls.map((c) => c.offset), [0, LIST_PAGE_SIZE, LIST_PAGE_SIZE * 2])
    assert.ok(calls.every((c) => c.folder === 'abc'))
  })

  it('una carpeta vacía o un fallo de Storage dan una lista vacía y no lanzan', async () => {
    assert.deepEqual(await listFolderPaths(bucket(), 'abc'), [])
    assert.deepEqual(await listFolderPaths(bucket({ list: async () => ({ data: null, error: new Error('x') }) }), 'abc'), [])
    assert.deepEqual(await listFolderPaths(bucket({ list: async () => { throw new Error('red') } }), 'abc'), [])
  })

  it('no sigue pidiendo páginas sin fin si Storage repite la misma página', async () => {
    let calls = 0
    const result = await listFolderPaths(bucket({ list: async () => { calls++; return { data: files(LIST_PAGE_SIZE), error: null } } }), 'abc')
    assert.ok(calls <= 101, `pidió ${calls} páginas`)
    assert.ok(result.length <= LIST_PAGE_SIZE)
  })
})
