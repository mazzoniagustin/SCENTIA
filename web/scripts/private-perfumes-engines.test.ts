// Test de integración contra la base real: los perfumes propios participan en la racha, los huecos y "qué me pongo" solo para
// su dueño (y con acordes en los dos últimos), y no aparecen en el catálogo, las marcas ni el quiz. Crea personas y perfumes de
// prueba y los elimina. Necesita DATABASE_URL y el SQL de perfumes propios ya aplicado.
//   npx tsx --conditions=react-server --test scripts/private-perfumes-engines.test.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { prisma } from '../src/lib/prisma'
import { getCollectionSamples } from '../src/lib/gaps/data'
import { getOutfitCandidates } from '../src/lib/outfit/data'
import { getWearOptions } from '../src/lib/wear/data'
import { listPerfumes } from '../src/lib/perfumes/list'
import { getAccordStats } from '../src/lib/accord-stats'
import { getSavedPerfumes } from '../src/lib/admin/audit-data'
import { deleteUserData, exportUserData } from '../src/lib/account/data'
import { createPrivatePerfume, listOwnPhotoPaths } from '../src/lib/private-perfumes/data'
import type { PrivatePerfumeInput } from '../src/lib/private-perfumes/validation'

const skip = !process.env.DATABASE_URL && 'sin DATABASE_URL'
const stamp = Date.now()
const brand = `MarcaEngine${stamp}`
const entry = { status: 'OWNED' as const }
const input = (name: string, accordIds: string[]): PrivatePerfumeInput => ({
  name, brand, perfumer: null, gender: 'unisex', description: null, topNotes: [], heartNotes: [], baseNotes: [], accordIds, longevity: 4, sillage: 3,
})

let userA: string
let userB: string
let accord: { id: string; name: string }
let catalogId: string
const withAccords = `Con acordes ${stamp}`
const withoutAccords = `Sin acordes ${stamp}`
let withAccordsId = ''
let withoutAccordsId = ''

describe('perfumes propios en los motores', { skip }, () => {
  before(async () => {
    userA = (await prisma.user.create({ data: { email: `ppe-a-${stamp}@example.test` }, select: { id: true } })).id
    userB = (await prisma.user.create({ data: { email: `ppe-b-${stamp}@example.test` }, select: { id: true } })).id
    accord = await prisma.accord.findFirstOrThrow({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
    catalogId = (await prisma.perfume.findFirstOrThrow({ where: { status: 'PUBLISHED', accords: { some: {} } }, select: { id: true } })).id

    withAccordsId = (await createPrivatePerfume(userA, `ppe-${stamp}-1`, 'sb/1.webp', input(withAccords, [accord.id]), entry)).id
    withoutAccordsId = (await createPrivatePerfume(userA, `ppe-${stamp}-2`, 'sb/2.webp', input(withoutAccords, []), entry)).id
    await prisma.userCollection.create({ data: { userId: userA, perfumeId: catalogId, status: 'OWNED' } })
  })

  after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB].filter(Boolean) } } })
    await prisma.$disconnect()
  })

  it('racha: aparecen los dos (con y sin acordes) en las opciones de su dueño, y también el del catálogo', async () => {
    const ids = (await getWearOptions(userA)).map((o) => o.perfumeId)
    assert.ok(ids.includes(withAccordsId))
    assert.ok(ids.includes(withoutAccordsId))
    assert.ok(ids.includes(catalogId))
    assert.deepEqual(await getWearOptions(userB), [])
  })

  it('huecos: cuenta el propio con acordes, no el que no tiene, y sigue contando el del catálogo', async () => {
    const samples = await getCollectionSamples(userA)
    const own = samples.find((s) => s.perfumeId === withAccordsId)
    assert.ok(own, 'falta el perfume propio con acordes')
    assert.deepEqual(own.accords, [{ name: accord.name, intensity: 70 }])
    assert.equal(own.sillage, 3)
    assert.equal(own.longevity, 4)
    assert.ok(!samples.some((s) => s.perfumeId === withoutAccordsId), 'el propio sin acordes no debe contar')
    assert.ok(samples.some((s) => s.perfumeId === catalogId))
    assert.deepEqual(await getCollectionSamples(userB), [])
  })

  it('qué me pongo: ofrece el propio con acordes, no el que no tiene, y no se lo ofrece a otra persona', async () => {
    const candidates = await getOutfitCandidates(userA)
    const own = candidates.find((c) => c.perfumeId === withAccordsId)
    assert.ok(own, 'falta el perfume propio con acordes')
    assert.equal(own.slug, null)
    assert.equal(own.sillage, 3)
    assert.deepEqual(own.accords, [{ name: accord.name, intensity: 70 }])
    assert.ok(!candidates.some((c) => c.perfumeId === withoutAccordsId))
    assert.ok(candidates.some((c) => c.perfumeId === catalogId))
    assert.deepEqual(await getOutfitCandidates(userB), [])
  })

  it('catálogo y marcas: el perfume propio no aparece, ni buscándolo por su nombre exacto', async () => {
    const result = await listPerfumes(new URLSearchParams({ q: withAccords }))
    assert.equal(result.ok, true)
    const body = (result as { ok: true; body: { perfumes?: Array<{ id: string }>; total?: number } }).body
    assert.ok(!(body.perfumes ?? []).some((p) => p.id === withAccordsId))
    // Marcas, portada, quiz y recomendaciones leen solo status = 'PUBLISHED' (getBrandIndex usa la caché de Next y no corre fuera de Next).
    assert.equal(await prisma.perfume.count({ where: { status: 'PUBLISHED', brand } }), 0)
  })

  it('la ficha pública del catálogo no lo expone: su estado es PRIVATE', async () => {
    const row = await prisma.perfume.findUniqueOrThrow({ where: { id: withAccordsId }, select: { status: true } })
    assert.equal(row.status, 'PRIVATE')
  })

  it('cuenta: la exportación incluye el perfume propio con sus datos y borrar la cuenta lo elimina', async () => {
    const knownAudits = new Set((await prisma.deletedAccountAudit.findMany({ select: { id: true } })).map((a) => a.id))
    const userC = (await prisma.user.create({ data: { email: `ppe-c-${stamp}@example.test` }, select: { id: true } })).id
    try {
      const id = (await createPrivatePerfume(userC, `ppe-${stamp}-c`, 'sb-c/c.webp', { ...input(`Exportable ${stamp}`, [accord.id]), perfumer: 'Alguien', topNotes: ['Limón'] }, entry)).id
      const exported = await exportUserData(userC)
      assert.ok(exported)
      const own = (exported as unknown as { ownPerfumes: Array<Record<string, unknown>> }).ownPerfumes
      assert.equal(own.length, 1)
      assert.equal(own[0].name, `Exportable ${stamp}`)
      assert.equal(own[0].perfumer, 'Alguien')
      assert.deepEqual(own[0].topNotes, ['Limón'])
      assert.deepEqual(own[0].accords, [accord.name])
      assert.equal(own[0].longevity, 4)
      assert.equal('imageUrl' in own[0], false, 'la ruta interna de la foto no es un dato de la persona')

      assert.deepEqual(await listOwnPhotoPaths(userC), ['sb-c/c.webp'])
      await deleteUserData(userC)
      assert.equal(await prisma.perfume.findUnique({ where: { id } }), null)
    } finally {
      const created = (await prisma.deletedAccountAudit.findMany({ select: { id: true } })).filter((a) => !knownAudits.has(a.id))
      await prisma.deletedAccountAudit.deleteMany({ where: { id: { in: created.map((a) => a.id) } } })
      await prisma.user.deleteMany({ where: { id: userC } })
    }
  })

  it('estadísticas: los acordes y el total del catálogo no cuentan los perfumes propios', async () => {
    const stats = await getAccordStats()
    assert.equal(stats.total, await prisma.perfume.count({ where: { ownerId: null } }))
    assert.equal(stats.dfById.get(accord.id), await prisma.perfumeAccord.count({ where: { accordId: accord.id, perfume: { ownerId: null } } }))
  })

  it('auditoría de admin: los perfumes propios no aparecen con el nombre que escribió la persona', async () => {
    const first = await getSavedPerfumes(1)
    const rows = [...first.rows]
    for (let page = 2; page <= first.pages; page++) rows.push(...(await getSavedPerfumes(page)).rows)
    assert.ok(rows.some((r) => r.id === catalogId), 'el del catálogo sigue apareciendo')
    assert.ok(!rows.some((r) => r.brand === brand), 'un perfume propio no debe verse en la auditoría')
    // El total de perfumes guardados tampoco cuenta los propios (calculado aparte, sin pasar por la consulta de la auditoría).
    const ownIds = new Set((await prisma.perfume.findMany({ where: { ownerId: { not: null } }, select: { id: true } })).map((p) => p.id))
    assert.ok(ownIds.has(withAccordsId))
    const saved = new Set([
      ...(await prisma.userCollection.findMany({ select: { perfumeId: true } })).map((c) => c.perfumeId),
      ...(await prisma.deletedAccountCollection.findMany({ select: { perfumeId: true } })).map((c) => c.perfumeId),
    ])
    for (const id of ownIds) saved.delete(id)
    assert.equal(first.totalPerfumes, saved.size)
  })
})
