// Test de integración contra la base real: acceso a datos de la colección compartida (src/lib/share/data.ts).
// Crea usuarios, perfumes y colecciones de prueba (marca con sello único) y los elimina al final.
// No se corre con el resto de los tests: necesita DATABASE_URL y el SQL de collection-share ya aplicado.
//   npx tsx --conditions=react-server --test scripts/collection-share-data.test.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '../src/lib/prisma'
import { createOrReplaceShare, getPublicShare, listShares, revokeShare } from '../src/lib/share/data'

const skip = !process.env.DATABASE_URL && 'sin DATABASE_URL'
const stamp = Date.now()
const brand = `CS Data Brand ${stamp}`

let userA: string
let userB: string
let userNoNick: string
const perfumeIds: Record<string, string> = {}

const mkPerfume = async (key: string, name: string, extra: Record<string, unknown> = {}) => {
  perfumeIds[key] = (await prisma.perfume.create({ data: { brand, name, gender: 'unisex', ...extra }, select: { id: true } })).id
  return perfumeIds[key]
}
const collect = (userId: string, perfumeId: string, status: 'OWNED' | 'WISHLIST' | 'SAMPLED', rating: number | null = null) =>
  prisma.userCollection.create({ data: { userId, perfumeId, status, rating, personalNotes: 'nota secreta' } })

describe('colección compartida (acceso a datos)', { skip }, () => {
  before(async () => {
    userA = (await prisma.user.create({ data: { email: `cs-data-a-${stamp}@example.test` }, select: { id: true } })).id
    userB = (await prisma.user.create({ data: { email: `cs-data-b-${stamp}@example.test` }, select: { id: true } })).id
    userNoNick = (await prisma.user.create({ data: { email: `cs-data-n-${stamp}@example.test` }, select: { id: true } })).id
    await prisma.userProfile.create({ data: { userId: userA, nickname: `csa${String(stamp).slice(-8)}` } })

    const zeta = await mkPerfume('zeta', 'Zeta')
    const alfa = await mkPerfume('alfa', 'Alfa')
    const deseo = await mkPerfume('deseo', 'Deseo')
    const muestra = await mkPerfume('muestra', 'Muestra')
    const privado = await mkPerfume('privado', 'Privado', { status: 'PRIVATE', ownerId: userA })
    const borrador = await mkPerfume('borrador', 'Borrador', { status: 'DRAFT' })
    const solo = await mkPerfume('solo', 'Solo')

    await collect(userA, zeta, 'OWNED', 4)
    await collect(userA, alfa, 'OWNED', 5)
    await collect(userA, muestra, 'OWNED', 3)
    await collect(userA, privado, 'OWNED', 2)
    await collect(userA, deseo, 'WISHLIST', 5)
    await collect(userA, borrador, 'WISHLIST')
    await collect(userB, solo, 'OWNED')
    await collect(userNoNick, solo, 'OWNED')
  })

  after(async () => {
    try {
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB, userNoNick].filter(Boolean) } } })
      await prisma.perfume.deleteMany({ where: { brand } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('devuelve las entradas OWNED (ordenadas) y ninguna WISHLIST, sin puntuaciones por defecto', async () => {
    const { token } = await createOrReplaceShare(userA, 'OWNED', false)
    const view = await getPublicShare(token)
    assert.ok(view)
    assert.equal(view.scope, 'OWNED')
    assert.deepEqual(view.entries.map((e) => e.name), ['Alfa', 'Muestra', 'Zeta'])
    assert.ok(view.entries.every((e) => e.rating === undefined))
    assert.ok(!JSON.stringify(view).includes('nota secreta'))
    assert.ok(!JSON.stringify(view).includes('@example.test'))
  })

  it('con showRatings = true en OWNED incluye las puntuaciones', async () => {
    const { token } = await createOrReplaceShare(userA, 'OWNED', true)
    const view = await getPublicShare(token)
    assert.equal(view?.showRatings, true)
    assert.deepEqual(view?.entries.map((e) => e.rating), [5, 3, 4])
  })

  it('regenerar el link invalida el token anterior', async () => {
    const old = await createOrReplaceShare(userA, 'OWNED', false)
    const fresh = await createOrReplaceShare(userA, 'OWNED', false)
    assert.notEqual(old.token, fresh.token)
    assert.equal(await getPublicShare(old.token), null)
    assert.ok(await getPublicShare(fresh.token))
  })

  it('revokeShare invalida el token y puede llamarse dos veces', async () => {
    const { token } = await createOrReplaceShare(userA, 'OWNED', false)
    await revokeShare(userA, 'OWNED')
    assert.equal(await getPublicShare(token), null)
    await assert.doesNotReject(revokeShare(userA, 'OWNED'))
  })

  it('un perfume que pasa de OWNED a SAMPLED sale de la vista; PRIVATE y DRAFT nunca aparecen', async () => {
    const owned = await createOrReplaceShare(userA, 'OWNED', false)
    const wish = await createOrReplaceShare(userA, 'WISHLIST', false)
    await prisma.userCollection.update({
      where: { userId_perfumeId: { userId: userA, perfumeId: perfumeIds.muestra } },
      data: { status: 'SAMPLED' },
    })
    const ownedView = await getPublicShare(owned.token)
    assert.deepEqual(ownedView?.entries.map((e) => e.name), ['Alfa', 'Zeta'])
    assert.ok(!ownedView?.entries.some((e) => e.id === perfumeIds.privado))
    const wishView = await getPublicShare(wish.token)
    assert.deepEqual(wishView?.entries.map((e) => e.name), ['Deseo'])
  })

  it('un WISHLIST creado con showRatings = true se guarda como false y sin puntuaciones', async () => {
    const { token } = await createOrReplaceShare(userA, 'WISHLIST', true)
    const view = await getPublicShare(token)
    assert.equal(view?.showRatings, false)
    assert.ok(view?.entries.every((e) => e.rating === undefined))
    const row = await prisma.collectionShare.findUniqueOrThrow({ where: { userId_scope: { userId: userA, scope: 'WISHLIST' } } })
    assert.equal(row.showRatings, false)
  })

  it('una persona no ve ni revoca los links de otra', async () => {
    const a = await createOrReplaceShare(userA, 'OWNED', false)
    await createOrReplaceShare(userB, 'OWNED', true)
    const listA = await listShares(userA)
    const listB = await listShares(userB)
    assert.ok(listA.every((s) => s.scope === 'OWNED' || s.scope === 'WISHLIST'))
    assert.deepEqual(listB.map((s) => s.scope), ['OWNED'])
    assert.equal(listB[0].showRatings, true)
    await revokeShare(userB, 'WISHLIST')
    await revokeShare(userB, 'OWNED')
    assert.ok(await getPublicShare(a.token))
    assert.equal((await listShares(userB)).length, 0)
  })

  it('un token con formato inválido devuelve null sin consultar la base', async () => {
    assert.equal(await getPublicShare('x'.repeat(5000)), null)
    assert.equal(await getPublicShare(''), null)
  })

  it('una persona sin apodo se muestra como "Una colección"', async () => {
    const { token } = await createOrReplaceShare(userNoNick, 'OWNED', false)
    assert.equal((await getPublicShare(token))?.ownerLabel, 'Una colección')
    const { token: tokenA } = await createOrReplaceShare(userA, 'OWNED', false)
    assert.match((await getPublicShare(tokenA))!.ownerLabel, /^csa/)
  })
})
