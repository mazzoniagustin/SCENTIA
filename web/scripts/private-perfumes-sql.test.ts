// Test de integración contra la base real: comprueba lo que agrega prisma/sql/2026-10-21-private-perfumes.sql (perfumes propios:
// unicidad parcial, CHECK de dueño y borrado en cascada). Crea usuarios y perfumes de prueba y los elimina al final.
// No se corre con el resto de los tests: necesita DATABASE_URL y el SQL ya aplicado.
//   npx tsx --conditions=react-server --test scripts/private-perfumes-sql.test.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '../src/lib/prisma'

const skip = !process.env.DATABASE_URL && 'sin DATABASE_URL'
const stamp = Date.now()
const brand = `Marca de prueba ${stamp}`

let userA: string
let userB: string
const createdPerfumeIds: string[] = []

const privatePerfume = (ownerId: string, overrides: Record<string, unknown> = {}) =>
  prisma.perfume.create({
    data: { brand, name: 'Mi perfume', gender: 'unisex', status: 'PRIVATE', ownerId, ...overrides },
    select: { id: true },
  })

describe('perfumes propios (SQL)', { skip }, () => {
  before(async () => {
    userA = (await prisma.user.create({ data: { email: `pp-a-${stamp}@example.test` }, select: { id: true } })).id
    userB = (await prisma.user.create({ data: { email: `pp-b-${stamp}@example.test` }, select: { id: true } })).id
  })

  after(async () => {
    await prisma.perfume.deleteMany({ where: { id: { in: createdPerfumeIds } } })
    await prisma.perfume.deleteMany({ where: { brand } })
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB].filter(Boolean) } } })
    await prisma.$disconnect()
  })

  it('dos personas pueden tener un perfume propio con la misma marca y nombre', async () => {
    createdPerfumeIds.push((await privatePerfume(userA)).id, (await privatePerfume(userB)).id)
  })

  it('la misma persona no puede repetirlo, ni cambiando mayúsculas', async () => {
    await assert.rejects(privatePerfume(userA), /Unique constraint|P2002/)
    await assert.rejects(privatePerfume(userA, { brand: brand.toUpperCase(), name: 'MI PERFUME' }), /Unique constraint|P2002/)
  })

  it('un perfume propio puede llamarse igual que uno del catálogo', async () => {
    const catalog = await prisma.perfume.create({ data: { brand, name: 'Mi perfume', gender: 'unisex', status: 'DRAFT' }, select: { id: true } })
    createdPerfumeIds.push(catalog.id)
  })

  it('dos perfumes del catálogo con la misma marca y nombre siguen chocando', async () => {
    await assert.rejects(prisma.perfume.create({ data: { brand, name: 'Mi perfume', gender: 'unisex', status: 'DRAFT' } }), /Unique constraint|P2002/)
  })

  it('un perfume PRIVATE sin dueño es rechazado por la base', async () => {
    await assert.rejects(prisma.perfume.create({ data: { brand, name: 'Sin dueño', gender: 'unisex', status: 'PRIVATE' } }), /Perfume_private_has_owner|check constraint/i)
  })

  it('guarda las notas libres y borrar la persona borra sus perfumes propios', async () => {
    const own = await privatePerfume(userB, { name: 'Con notas', topNotes: ['Limón'], heartNotes: ['Jazmín'], baseNotes: ['Ámbar'] })
    const row = await prisma.perfume.findUniqueOrThrow({ where: { id: own.id }, select: { topNotes: true, heartNotes: true, baseNotes: true } })
    assert.deepEqual(row, { topNotes: ['Limón'], heartNotes: ['Jazmín'], baseNotes: ['Ámbar'] })

    await prisma.user.delete({ where: { id: userB } })
    assert.equal(await prisma.perfume.count({ where: { ownerId: userB } }), 0)
    assert.equal(await prisma.perfume.findUnique({ where: { id: own.id } }), null)
  })

  it('el bucket de fotos no deja escribir ni leer directo con la sesión de la persona (solo el servidor, con URLs firmadas)', async () => {
    // Sin políticas sobre storage.objects para este bucket, la clave publicable no puede subir, pisar, borrar ni listar archivos:
    // todo pasa por las acciones del servidor (límite de frecuencia, ruta verificada). Se corrige con
    // prisma/sql/2026-10-21-private-perfumes-storage-lock.sql.
    const policies = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND (qual ILIKE '%private-perfumes%' OR with_check ILIKE '%private-perfumes%')`
    assert.deepEqual(policies.map((p) => p.policyname), [])
    const bucket = await prisma.$queryRaw<Array<{ public: boolean; file_size_limit: number | null }>>`
      SELECT public, file_size_limit FROM storage.buckets WHERE id = 'private-perfumes'`
    assert.deepEqual(bucket.map((b) => [b.public, Number(b.file_size_limit)]), [[false, 307200]])
  })
})
