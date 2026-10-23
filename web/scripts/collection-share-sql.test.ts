// Test de integración contra la base real: comprueba lo que agrega prisma/sql/2026-10-23-collection-share.sql (links para compartir
// la colección: unicidad por persona y lista, hash de token único, CHECK de calificaciones y borrado en cascada).
// Crea usuarios de prueba y los elimina al final.
// No se corre con el resto de los tests: necesita DATABASE_URL y el SQL ya aplicado.
//   npx tsx --conditions=react-server --test scripts/collection-share-sql.test.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '../src/lib/prisma'

const skip = !process.env.DATABASE_URL && 'sin DATABASE_URL'
const stamp = Date.now()

let userA: string
let userB: string

const share = (userId: string, scope: 'OWNED' | 'WISHLIST', tokenHash: string, showRatings = false) =>
  prisma.collectionShare.create({ data: { userId, scope, tokenHash, showRatings }, select: { id: true } })

describe('links para compartir la colección (SQL)', { skip }, () => {
  before(async () => {
    userA = (await prisma.user.create({ data: { email: `cs-a-${stamp}@example.test` }, select: { id: true } })).id
    userB = (await prisma.user.create({ data: { email: `cs-b-${stamp}@example.test` }, select: { id: true } })).id
  })

  after(async () => {
    // Borrar las personas se lleva sus links en cascada.
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB].filter(Boolean) } } })
    await prisma.$disconnect()
  })

  it('una persona puede tener un link por lista, y rechaza un segundo con el mismo (userId, scope)', async () => {
    await share(userA, 'OWNED', `hash-a-owned-${stamp}`)
    await share(userA, 'WISHLIST', `hash-a-wishlist-${stamp}`)
    await assert.rejects(share(userA, 'OWNED', `hash-a-owned-2-${stamp}`), /Unique constraint|P2002/)
  })

  it('rechaza showRatings = true con scope WISHLIST (CHECK de la base)', async () => {
    await assert.rejects(share(userB, 'WISHLIST', `hash-b-wishlist-${stamp}`, true), /CollectionShare_ratings_only_owned|check constraint/i)
  })

  it('acepta showRatings = true con scope OWNED', async () => {
    await share(userB, 'OWNED', `hash-b-owned-${stamp}`, true)
  })

  it('rechaza un tokenHash repetido', async () => {
    await assert.rejects(share(userB, 'WISHLIST', `hash-a-owned-${stamp}`), /Unique constraint|P2002/)
  })

  it('borrar la persona borra sus links', async () => {
    assert.equal(await prisma.collectionShare.count({ where: { userId: userA } }), 2)
    await prisma.user.delete({ where: { id: userA } })
    assert.equal(await prisma.collectionShare.count({ where: { userId: userA } }), 0)
  })
})
