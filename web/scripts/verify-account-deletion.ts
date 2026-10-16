// Verifica contra la base real que eliminar una cuenta guarda un resumen anónimo (docs/retencion-eliminacion-cuenta.md)
// dentro de la misma transacción, con usuarios de prueba que se crean y se eliminan. Los registros de auditoría que genera
// la prueba se borran al final (se identifican por no existir antes de empezar).
//   npx tsx scripts/verify-account-deletion.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getOrCreateUser } from '../src/lib/auth'
import { deleteUserData, saveQuizAnswers } from '../src/lib/account/data'
import type { QuizAnswers } from '../src/lib/quiz/questions'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

const answers: QuizAnswers = {
  ambiente: 'mar', estacion: 'verano', ocasion: 'deporte', dulzor: 'nada', estilo: 'suave',
  familias: ['citrico'], evitar: ['oud'],
}

async function main() {
  const stamp = Date.now()
  const email = `verify-del-${stamp}@example.test`
  const user = await getOrCreateUser({ user: { id: `verify-del-${stamp}`, email } })
  const other = await getOrCreateUser({ user: { id: `verify-del-other-${stamp}`, email: `verify-del-other-${stamp}@example.test` } })
  const knownAudits = new Set((await prisma.deletedAccountAudit.findMany({ select: { id: true } })).map((a) => a.id))
  try {
    const [p1, p2, p3] = await prisma.perfume.findMany({ select: { id: true }, take: 3, orderBy: { id: 'asc' } })
    await prisma.userCollection.createMany({
      data: [
        { userId: user.id, perfumeId: p1.id, status: 'OWNED', rating: 4, personalNotes: 'SECRETO-NOTA' },
        { userId: user.id, perfumeId: p2.id, status: 'WISHLIST' },
        { userId: user.id, perfumeId: p3.id, status: 'DISLIKED', rating: 1 },
        { userId: other.id, perfumeId: p1.id, status: 'OWNED', rating: 5 },
      ],
    })
    await prisma.wearLog.createMany({
      data: [
        { userId: user.id, day: '2026-10-01', perfumeId: p1.id },
        { userId: user.id, day: '2026-10-02', perfumeId: p1.id },
      ],
    })
    await saveQuizAnswers(user.id, answers)
    const nickname = (await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } })).nickname

    // Atomicidad: si algo falla después de guardar el resumen, no queda nada a medias (ni se borra el usuario).
    await assert.rejects(
      deleteUserData(user.id, { afterArchive: async () => { throw new Error('fallo de prueba') } }),
      /fallo de prueba/,
    )
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 1, 'el usuario sigue existiendo')
    assert.equal(await prisma.userCollection.count({ where: { userId: user.id } }), 3, 'la colección sigue intacta')
    const orphanAudits = (await prisma.deletedAccountAudit.findMany({ select: { id: true } })).filter((a) => !knownAudits.has(a.id))
    assert.equal(orphanAudits.length, 0, 'el resumen se deshizo con la transacción')
    console.log('OK  atomicidad: ante un fallo no se borra el usuario ni queda un resumen huérfano')

    const deleted = await deleteUserData(user.id)
    assert.deepEqual(deleted, { collection: 3, profile: 1 })
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
    console.log('OK  eliminación: el usuario ya no existe')

    const audits = (await prisma.deletedAccountAudit.findMany({ include: { collection: true } })).filter((a) => !knownAudits.has(a.id))
    assert.equal(audits.length, 1, 'exactamente un resumen nuevo')
    const audit = audits[0]
    assert.notEqual(audit.id, user.id, 'el id del resumen no es el de la persona')
    assert.match(audit.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'UUID v4: sin marca de tiempo (un cuid v1 revelaría la hora exacta de la baja)')
    assert.equal(audit.collectionTotal, 3)
    assert.equal(audit.ownedCount, 1)
    assert.equal(audit.wishlistCount, 1)
    assert.equal(audit.dislikedCount, 1)
    assert.equal(audit.sampledCount, 0)
    assert.equal(audit.ratingsCount, 2)
    assert.equal(audit.ratingsSum, 5)
    assert.equal(audit.longestStreak, 2)
    assert.equal(audit.wearDaysTotal, 2)
    assert.equal(audit.hadQuizProfile, true)
    assert.match(audit.signedUpMonth, /^\d{4}-\d{2}$/)
    assert.match(audit.deletedMonth, /^\d{4}-\d{2}$/)
    console.log('OK  resumen: conteos, valoraciones, racha, quiz y meses correctos')

    assert.deepEqual(
      audit.collection.map((c) => [c.perfumeId, c.status, c.rating]).sort(),
      [[p1.id, 'OWNED', 4], [p2.id, 'WISHLIST', null], [p3.id, 'DISLIKED', 1]].sort(),
    )
    console.log('OK  filas anónimas: coinciden con la colección real (perfume, estado, valoración)')

    const dump = JSON.stringify(audit)
    for (const secret of [email, user.id, 'SECRETO-NOTA', nickname, user.supabaseId].filter((s): s is string => Boolean(s))) {
      assert.ok(!dump.includes(secret), `el resumen no contiene ${secret === email ? 'el correo' : 'datos personales'}`)
    }
    console.log('OK  privacidad: el resumen no contiene correo, id, apodo, supabaseId ni notas')

    // Colección grande: la transacción no puede agotar su tiempo (5 s por defecto en Prisma).
    const big = await getOrCreateUser({ user: { id: `verify-del-big-${stamp}`, email: `verify-del-big-${stamp}@example.test` } })
    const many = await prisma.perfume.findMany({ select: { id: true }, take: 400, orderBy: { id: 'asc' } })
    await prisma.userCollection.createMany({ data: many.map((p) => ({ userId: big.id, perfumeId: p.id, status: 'OWNED' as const })) })
    const t0 = Date.now()
    await deleteUserData(big.id)
    const bigMs = Date.now() - t0
    const bigAudit = (await prisma.deletedAccountAudit.findMany({ include: { _count: { select: { collection: true } } } })).filter(
      (a) => !knownAudits.has(a.id) && a.collectionTotal === many.length,
    )
    assert.equal(bigAudit.length, 1)
    assert.equal(bigAudit[0]._count.collection, many.length)
    console.log(`OK  colección grande (${many.length} perfumes): se elimina y se archiva completa en ${bigMs} ms`)

    assert.equal(await prisma.user.count({ where: { id: other.id } }), 1, 'otra persona intacta')
    assert.equal(await prisma.userCollection.count({ where: { userId: other.id } }), 1)
    console.log('OK  otra persona: su cuenta y su colección no se tocan')
  } finally {
    await prisma.user.deleteMany({ where: { email: { contains: `${stamp}@example.test` } } })
    // Limpieza: borra solo los resúmenes que creó esta prueba (la cascada borra sus filas).
    const created = (await prisma.deletedAccountAudit.findMany({ select: { id: true } })).filter((a) => !knownAudits.has(a.id))
    await prisma.deletedAccountAudit.deleteMany({ where: { id: { in: created.map((a) => a.id) } } })
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
