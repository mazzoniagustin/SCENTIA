// Verifica contra el Supabase real el ciclo de una foto de perfume propio: URL de subida firmada, subida directa, existencia,
// URL de lectura firmada, rechazo de lo que no es WebP y borrado. Usa una carpeta de prueba que se elimina al final.
//   npx tsx --conditions=react-server scripts/verify-private-perfumes-storage.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

import { PHOTO_BUCKET } from '../src/lib/private-perfumes/photo'
import { createUploadTarget, photoExists, removeAllPhotosOf, removePhotos, signPhotoUrls } from '../src/lib/private-perfumes/storage'

// WebP de 1x1 píxel.
const TINY_WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64')

async function main() {
  const folder = `verify-${Date.now()}`
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string)
  const paths: string[] = []
  try {
    const target = await createUploadTarget(folder, 'foto-1')
    assert.ok(target, 'createUploadTarget devolvió null (¿falta SUPABASE_SERVICE_ROLE_KEY o el bucket?)')
    paths.push(target.path)
    assert.equal(target.path, `${folder}/foto-1.webp`)
    console.log('OK  URL de subida firmada')

    assert.deepEqual(await photoExists(target.path), { exists: false, bytes: 0 })
    const up = await anon.storage.from(PHOTO_BUCKET).uploadToSignedUrl(target.path, target.token, TINY_WEBP, { contentType: 'image/webp' })
    assert.equal(up.error, null, `subida: ${up.error?.message}`)
    console.log('OK  subida directa con el token')

    const stat = await photoExists(target.path)
    assert.equal(stat.exists, true)
    assert.equal(stat.bytes, TINY_WEBP.length)
    console.log(`OK  existe y pesa ${stat.bytes} bytes`)

    const signed = (await signPhotoUrls([target.path, `${folder}/no-existe.webp`])).get(target.path)
    assert.ok(signed, 'no se firmó la URL de lectura')
    const res = await fetch(signed)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/webp')
    console.log('OK  URL de lectura firmada sirve la imagen')

    const direct = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${target.path}`)
    assert.notEqual(direct.status, 200)
    console.log(`OK  el bucket es privado (acceso público directo: ${direct.status})`)

    const bad = await createUploadTarget(folder, 'foto-2')
    assert.ok(bad)
    paths.push(bad.path)
    const rejected = await anon.storage.from(PHOTO_BUCKET).uploadToSignedUrl(bad.path, bad.token, Buffer.from('no soy una imagen'), { contentType: 'text/plain' })
    assert.ok(rejected.error, 'el bucket aceptó un archivo que no es WebP')
    console.log('OK  rechaza lo que no es WebP')

    // Al eliminar la cuenta se borra toda la carpeta, también lo subido y nunca guardado en la base.
    const stray = await createUploadTarget(folder, 'foto-3')
    assert.ok(stray)
    paths.push(stray.path)
    assert.equal((await anon.storage.from(PHOTO_BUCKET).uploadToSignedUrl(stray.path, stray.token, TINY_WEBP, { contentType: 'image/webp' })).error, null)
    assert.equal((await photoExists(stray.path)).exists, true)
    await removeAllPhotosOf(folder, [])
    assert.equal((await photoExists(target.path)).exists, false)
    assert.equal((await photoExists(stray.path)).exists, false)
    console.log('OK  removeAllPhotosOf borra toda la carpeta de la persona, sin necesitar las rutas de la base')
  } finally {
    await removePhotos(paths)
    console.log((await photoExists(`${folder}/foto-1.webp`)).exists ? 'FALLÓ la limpieza' : 'OK  limpieza')
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
