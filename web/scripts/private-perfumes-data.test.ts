// Test de integración contra la base real de src/lib/private-perfumes/data.ts. Crea personas y acordes de prueba y los elimina.
// Necesita DATABASE_URL y el SQL de perfumes propios ya aplicado.
//   npx tsx --conditions=react-server --test scripts/private-perfumes-data.test.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '../src/lib/prisma'
import { upsertCollectionForUser } from '../src/lib/collection/data'
import {
  createPrivatePerfume, deletePrivatePerfume, getOwnPrivatePerfume, isDuplicatePerfumeError, listOwnPhotoPaths, updatePrivatePerfume,
} from '../src/lib/private-perfumes/data'
import type { PrivatePerfumeInput } from '../src/lib/private-perfumes/validation'

const skip = !process.env.DATABASE_URL && 'sin DATABASE_URL'
const stamp = Date.now()
const entry = { status: 'OWNED' as const, rating: 4, personalNotes: 'Me lo regalaron' }
const input = (overrides: Partial<PrivatePerfumeInput> = {}): PrivatePerfumeInput => ({
  name: `Perfume de prueba ${stamp}`, brand: `Marca ${stamp}`, perfumer: 'Alguien', gender: 'unisex', description: null,
  topNotes: ['Limón'], heartNotes: ['Jazmín'], baseNotes: ['Ámbar'], accordIds: [], longevity: 4, sillage: 3, ...overrides,
})

let userA: string
let userB: string
let accordIds: string[]
let n = 0
const newId = () => `pp-test-${stamp}-${++n}`

describe('data de perfumes propios', { skip }, () => {
  before(async () => {
    userA = (await prisma.user.create({ data: { email: `ppd-a-${stamp}@example.test` }, select: { id: true } })).id
    userB = (await prisma.user.create({ data: { email: `ppd-b-${stamp}@example.test` }, select: { id: true } })).id
    accordIds = (await prisma.accord.findMany({ take: 3, orderBy: { name: 'asc' }, select: { id: true } })).map((a) => a.id)
    assert.equal(accordIds.length, 3)
  })

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB].filter(Boolean) } } })
    await prisma.$disconnect()
  })

  it('crea el perfume privado con sus acordes y su entrada de colección', async () => {
    const id = newId()
    await createPrivatePerfume(userA, id, 'sb-a/x.webp', input({ accordIds: accordIds.slice(0, 2) }), entry)
    const row = await prisma.perfume.findUniqueOrThrow({ where: { id }, include: { accords: true } })
    assert.equal(row.status, 'PRIVATE')
    assert.equal(row.ownerId, userA)
    assert.equal(row.imageUrl, 'sb-a/x.webp')
    assert.equal(row.longevity, 4)
    assert.equal(row.sillage, 3)
    assert.equal(row.source, null)
    assert.deepEqual(row.topNotes, ['Limón'])
    assert.deepEqual(row.accords.map((a) => a.intensity), [70, 70])
    const collection = await prisma.userCollection.findUniqueOrThrow({ where: { userId_perfumeId: { userId: userA, perfumeId: id } } })
    assert.deepEqual([collection.status, collection.rating, collection.personalNotes], ['OWNED', 4, 'Me lo regalaron'])
  })

  it('getOwnPrivatePerfume devuelve el perfume solo a su dueño', async () => {
    const id = newId()
    await createPrivatePerfume(userA, id, 'sb-a/y.webp', input({ name: `Otro ${stamp}`, accordIds: [accordIds[0]] }), entry)
    const own = await getOwnPrivatePerfume(userA, id)
    assert.equal(own?.name, `Otro ${stamp}`)
    assert.equal(own?.accords.length, 1)
    assert.equal(own?.entry.status, 'OWNED')
    assert.equal(await getOwnPrivatePerfume(userB, id), null)
    assert.equal(await getOwnPrivatePerfume(userA, 'no-existe'), null)
  })

  it('un perfume del catálogo no se puede leer como propio', async () => {
    const catalog = await prisma.perfume.findFirstOrThrow({ where: { status: 'PUBLISHED' }, select: { id: true } })
    assert.equal(await getOwnPrivatePerfume(userA, catalog.id), null)
  })

  it('otra persona puede crear uno con el mismo nombre; la misma persona, no', async () => {
    const same = input({ name: `Repetido ${stamp}` })
    await createPrivatePerfume(userA, newId(), 'sb-a/r.webp', same, entry)
    await createPrivatePerfume(userB, newId(), 'sb-b/r.webp', same, entry)
    await assert.rejects(createPrivatePerfume(userA, newId(), 'sb-a/r2.webp', same, entry), (e) => isDuplicatePerfumeError(e))
  })

  it('rechaza un acorde que no existe sin dejar nada guardado', async () => {
    const id = newId()
    await assert.rejects(createPrivatePerfume(userA, id, 'sb-a/z.webp', input({ name: `Acorde malo ${stamp}`, accordIds: ['no-existe'] }), entry), /acorde/i)
    assert.equal(await prisma.perfume.findUnique({ where: { id } }), null)
  })

  it('update reemplaza datos, acordes y entrada; no toca el de otra persona', async () => {
    const id = newId()
    await createPrivatePerfume(userA, id, 'sb-a/u.webp', input({ name: `Editable ${stamp}`, accordIds: [accordIds[0]] }), entry)
    assert.equal(await updatePrivatePerfume(userB, id, undefined, input({ name: 'Intruso' }), entry), false)
    assert.equal((await prisma.perfume.findUniqueOrThrow({ where: { id } })).name, `Editable ${stamp}`)

    const ok = await updatePrivatePerfume(userA, id, 'sb-a/u2.webp', input({ name: `Editado ${stamp}`, topNotes: [], accordIds: [accordIds[1], accordIds[2]] }), { status: 'WISHLIST' })
    assert.equal(ok, true)
    const row = await prisma.perfume.findUniqueOrThrow({ where: { id }, include: { accords: true } })
    assert.equal(row.name, `Editado ${stamp}`)
    assert.equal(row.imageUrl, 'sb-a/u2.webp')
    assert.deepEqual(row.topNotes, [])
    assert.deepEqual(row.accords.map((a) => a.accordId).sort(), [accordIds[1], accordIds[2]].sort())
    const collection = await prisma.userCollection.findUniqueOrThrow({ where: { userId_perfumeId: { userId: userA, perfumeId: id } } })
    assert.deepEqual([collection.status, collection.rating, collection.personalNotes], ['WISHLIST', null, null])
  })

  it('update sin foto nueva conserva la ruta anterior', async () => {
    const id = newId()
    await createPrivatePerfume(userA, id, 'sb-a/k.webp', input({ name: `Conserva ${stamp}` }), entry)
    await updatePrivatePerfume(userA, id, undefined, input({ name: `Conserva 2 ${stamp}` }), entry)
    assert.equal((await prisma.perfume.findUniqueOrThrow({ where: { id } })).imageUrl, 'sb-a/k.webp')
  })

  it('delete borra perfume, acordes y colección, y devuelve la ruta de la foto', async () => {
    const id = newId()
    await createPrivatePerfume(userA, id, 'sb-a/d.webp', input({ name: `Borrable ${stamp}`, accordIds: [accordIds[0]] }), entry)
    assert.equal(await deletePrivatePerfume(userB, id), null)
    assert.ok(await prisma.perfume.findUnique({ where: { id } }))
    assert.equal(await deletePrivatePerfume(userA, id), 'sb-a/d.webp')
    assert.equal(await prisma.perfume.findUnique({ where: { id } }), null)
    assert.equal(await prisma.perfumeAccord.count({ where: { perfumeId: id } }), 0)
    assert.equal(await prisma.userCollection.count({ where: { perfumeId: id } }), 0)
    assert.equal(await deletePrivatePerfume(userA, id), null)
  })

  it('listOwnPhotoPaths lista solo las fotos de esa persona', async () => {
    assert.deepEqual(await listOwnPhotoPaths(userB), ['sb-b/r.webp'])
    assert.ok((await listOwnPhotoPaths(userA)).includes('sb-a/r.webp'))
    assert.ok(!(await listOwnPhotoPaths(userA)).includes('sb-b/r.webp'))
  })

  it('nadie puede guardar en su colección el perfume propio de otra persona', async () => {
    const id = newId()
    await createPrivatePerfume(userA, id, 'sb-a/g.webp', input({ name: `Ajeno ${stamp}` }), entry)
    await assert.rejects(upsertCollectionForUser(userB, { perfumeId: id, status: 'OWNED' }), /no disponible/i)
    assert.equal(await prisma.userCollection.count({ where: { userId: userB, perfumeId: id } }), 0)
    // Su dueño sí puede cambiar el estado de lo suyo, y el catálogo sigue funcionando.
    await upsertCollectionForUser(userA, { perfumeId: id, status: 'SAMPLED' })
    assert.equal((await prisma.userCollection.findUniqueOrThrow({ where: { userId_perfumeId: { userId: userA, perfumeId: id } } })).status, 'SAMPLED')
    const catalog = await prisma.perfume.findFirstOrThrow({ where: { status: 'PUBLISHED' }, select: { id: true } })
    await upsertCollectionForUser(userB, { perfumeId: catalog.id, status: 'WISHLIST' })
  })
})
