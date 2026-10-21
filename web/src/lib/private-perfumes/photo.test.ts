import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { checkUploadedPhoto, isOwnPhotoPath, isOwnPhotoUrl, MAX_PHOTO_BYTES, PHOTO_BUCKET, photoPath } from './photo.ts'

describe('photoPath', () => {
  it('arma la ruta con el id de Supabase como carpeta', () => {
    assert.equal(photoPath('abc', 'p1'), 'abc/p1.webp')
  })

  it('usa .jpg cuando el navegador no pudo codificar WebP', () => {
    assert.equal(photoPath('abc', 'p1', 'jpg'), 'abc/p1.jpg')
  })
})

describe('isOwnPhotoPath', () => {
  it('acepta solo una ruta de la propia carpeta con extensión webp o jpg', () => {
    assert.equal(isOwnPhotoPath('abc', 'abc/p1.webp'), true)
    assert.equal(isOwnPhotoPath('abc', 'abc/p1.jpg'), true)
    for (const path of ['xyz/p1.webp', 'abc/../xyz/p1.webp', 'abc/p1.png', 'abc/sub/p1.webp', 'abc/.webp', 'abc/.jpg', 'abc/p1.jpeg', 'abc/', '', undefined, null, 5]) {
      assert.equal(isOwnPhotoPath('abc', path), false, String(path))
    }
  })

  it('rechaza un id de Supabase vacío', () => {
    assert.equal(isOwnPhotoPath('', '/p1.webp'), false)
  })
})

describe('constantes', () => {
  it('usa el bucket y el tope del spec', () => {
    assert.equal(PHOTO_BUCKET, 'private-perfumes')
    assert.equal(MAX_PHOTO_BYTES, 307200)
  })
})

describe('checkUploadedPhoto', () => {
  const stat = (exists: boolean, bytes = 0) => ({ exists, bytes })

  it('acepta una foto propia que existe y pesa menos del tope', () => {
    assert.deepEqual(checkUploadedPhoto('abc', 'abc/p1.webp', stat(true, 90_000)), { ok: true })
    assert.deepEqual(checkUploadedPhoto('abc', 'abc/p1.webp', stat(true, MAX_PHOTO_BYTES)), { ok: true })
  })

  it('rechaza la ruta de otra persona aunque el archivo exista', () => {
    const result = checkUploadedPhoto('abc', 'xyz/p1.webp', stat(true, 90_000))
    assert.equal(result.ok, false)
  })

  it('rechaza una foto que no se subió, vacía o demasiado grande', () => {
    for (const s of [stat(false), stat(true, 0), stat(true, MAX_PHOTO_BYTES + 1)]) {
      assert.equal(checkUploadedPhoto('abc', 'abc/p1.webp', s).ok, false)
    }
  })
})

describe('isOwnPhotoUrl', () => {
  const sb = 'https://abc.supabase.co'
  const good = `${sb}/storage/v1/object/sign/private-perfumes/abc/p1.webp?token=xyz`

  it('reconoce la URL firmada del bucket de fotos propias', () => {
    assert.equal(isOwnPhotoUrl(good, sb), true)
    assert.equal(isOwnPhotoUrl(good, `${sb}/`), true)
  })

  it('rechaza otros hosts, otros buckets, http y entradas raras', () => {
    for (const url of [
      'https://evil.example/storage/v1/object/sign/private-perfumes/abc/p1.webp?token=x',
      `${sb}/storage/v1/object/sign/otro-bucket/abc/p1.webp?token=x`,
      `${sb}/storage/v1/object/public/private-perfumes/abc/p1.webp`,
      good.replace('https:', 'http:'),
      `https://user:pass@abc.supabase.co/storage/v1/object/sign/private-perfumes/a.webp`,
      'javascript:alert(1)', '', undefined, null, 5,
    ]) assert.equal(isOwnPhotoUrl(url, sb), false, String(url))
  })

  it('rechaza todo si no hay URL de Supabase configurada', () => {
    assert.equal(isOwnPhotoUrl(good, undefined), false)
    assert.equal(isOwnPhotoUrl(good, 'no es una url'), false)
  })
})
