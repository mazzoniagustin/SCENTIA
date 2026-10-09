// Verifica contra la base real el registro diario de uso y la racha, con usuarios de prueba que se crean y se eliminan.
//   npx tsx scripts/verify-wear.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getOrCreateUser } from '../src/lib/auth'
import { deleteUserData, exportUserData } from '../src/lib/account/data'
import { getCollectionOverview, getWearOptions, getWearSummary, logWearToday } from '../src/lib/wear/data'
import { upsertCollectionForUser } from '../src/lib/collection/data'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })
// Mediodía UTC de cada fecha: cae en el mismo día de Buenos Aires.
const at = (day: string) => new Date(`${day}T15:00:00Z`)

async function main() {
  const stamp = Date.now()
  const user = await getOrCreateUser({ user: { id: `verify-${stamp}`, email: `verify-${stamp}@example.test` } })
  const other = await getOrCreateUser({ user: { id: `verify-other-${stamp}`, email: `verify-other-${stamp}@example.test` } })
  try {
    const [a, b, c] = await prisma.perfume.findMany({ where: { status: 'PUBLISHED' }, select: { id: true }, take: 3, orderBy: { id: 'asc' } })
    await prisma.userCollection.createMany({
      data: [
        { userId: user.id, perfumeId: a.id, status: 'OWNED' },
        { userId: user.id, perfumeId: b.id, status: 'SAMPLED' },
        { userId: user.id, perfumeId: c.id, status: 'WISHLIST' },
      ],
    })

    // Opciones: solo lo que se usa (OWNED y SAMPLED).
    const options = await getWearOptions(user.id)
    assert.deepEqual(options.map((o) => o.perfumeId).sort(), [a.id, b.id].sort())
    console.log('OK  opciones: solo OWNED y SAMPLED (WISHLIST excluido)')

    // Reglas de registro.
    assert.deepEqual(await logWearToday(user.id, c.id, at('2026-10-05')), { ok: false, error: 'not_in_collection' })
    assert.deepEqual(await logWearToday(user.id, 123, at('2026-10-05')), { ok: false, error: 'invalid' })
    assert.deepEqual(await logWearToday(user.id, 'no-existe', at('2026-10-05')), { ok: false, error: 'not_in_collection' })
    assert.deepEqual(await logWearToday(other.id, a.id, at('2026-10-05')), { ok: false, error: 'not_in_collection' })
    console.log('OK  rechaza wishlist, id inválido, perfume inexistente y perfume de otra persona')

    // Racha: 5, 6, 7 (hueco el 8), 9.
    for (const day of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09']) {
      assert.deepEqual(await logWearToday(user.id, a.id, at(day)), { ok: true })
    }
    let s = await getWearSummary(user.id, at('2026-10-09'))
    assert.deepEqual(s.streak, { current: 1, best: 3, loggedToday: true, total: 4 })
    assert.equal(s.today?.perfumeId, a.id)
    console.log('OK  racha con un hueco: actual 1, mejor 3, 4 días')

    // Sigue viva si falta hoy pero está ayer; se rompe si se pasó un día entero.
    s = await getWearSummary(user.id, at('2026-10-10'))
    assert.deepEqual([s.streak.current, s.streak.loggedToday, s.today], [1, false, null])
    s = await getWearSummary(user.id, at('2026-10-11'))
    assert.equal(s.streak.current, 0)
    assert.equal(s.streak.best, 3)
    console.log('OK  viva si falta hoy; se reinicia tras un día salteado; se conserva el récord')

    // Un perfume por día, editable (no crea una fila nueva).
    assert.deepEqual(await logWearToday(user.id, b.id, at('2026-10-09')), { ok: true })
    assert.equal(await prisma.wearLog.count({ where: { userId: user.id, day: '2026-10-09' } }), 1)
    s = await getWearSummary(user.id, at('2026-10-09'))
    assert.equal(s.today?.perfumeId, b.id)
    assert.equal(s.streak.total, 4)
    console.log('OK  cambiar el perfume de hoy actualiza la fila (un perfume por día)')

    // Aislamiento y exportación.
    assert.equal((await getWearSummary(other.id, at('2026-10-09'))).streak.total, 0)
    const exported = await exportUserData(user.id)
    assert.equal(exported?.wearLogs.length, 4)
    assert.ok(exported?.wearLogs.every((w) => w.day && w.perfume.id))
    console.log('OK  la otra persona no ve nada; la exportación incluye los 4 registros')

    // Bajar de estado un perfume (a WISHLIST) no borra el historial.
    await prisma.userCollection.update({ where: { userId_perfumeId: { userId: user.id, perfumeId: a.id } }, data: { status: 'WISHLIST' } })
    assert.equal((await getWearSummary(user.id, at('2026-10-09'))).streak.total, 4)
    console.log('OK  cambiar el estado en la colección no borra el historial')

    // Flujo de la colección a la racha: con la colección solo en "Lo quiero" no hay nada para elegir; al pasarlo a "Lo tengo" sí.
    const fresh = await getOrCreateUser({ user: { id: `verify-fresh-${stamp}`, email: `verify-fresh-${stamp}@example.test` } })
    try {
      assert.deepEqual(await getCollectionOverview(fresh.id), { total: 0, wearable: 0 })
      assert.deepEqual(await getWearOptions(fresh.id), [])
      await upsertCollectionForUser(fresh.id, { perfumeId: a.id, status: 'WISHLIST' })
      assert.deepEqual(await getCollectionOverview(fresh.id), { total: 1, wearable: 0 })
      assert.deepEqual(await getWearOptions(fresh.id), [])
      assert.deepEqual(await logWearToday(fresh.id, a.id, at('2026-10-09')), { ok: false, error: 'not_in_collection' })
      await upsertCollectionForUser(fresh.id, { perfumeId: a.id, status: 'OWNED', rating: 4, personalNotes: 'nota' })
      assert.deepEqual(await getCollectionOverview(fresh.id), { total: 1, wearable: 1 })
      assert.equal((await getWearOptions(fresh.id)).length, 1)
      assert.deepEqual(await logWearToday(fresh.id, a.id, at('2026-10-09')), { ok: true })
      // Actualizar sin puntuación ni notas las borra (el formulario manda lo que se ve).
      await upsertCollectionForUser(fresh.id, { perfumeId: a.id, status: 'SAMPLED' })
      const row = await prisma.userCollection.findUniqueOrThrow({ where: { userId_perfumeId: { userId: fresh.id, perfumeId: a.id } } })
      assert.deepEqual([row.status, row.rating, row.personalNotes], ['SAMPLED', null, null])
      console.log('OK  colección → racha: "Lo quiero" no se puede usar; "Lo tengo" y "Probé una muestra" sí; actualizar limpia puntuación y notas')
    } finally {
      await prisma.user.deleteMany({ where: { id: fresh.id } })
    }

    // Eliminación de cuenta: cascada, sin tocar a la otra persona.
    await logWearToday(other.id, 'x', at('2026-10-09')).catch(() => null)
    await deleteUserData(user.id)
    assert.equal(await prisma.wearLog.count({ where: { userId: user.id } }), 0)
    assert.ok(await prisma.user.findUnique({ where: { id: other.id } }))
    console.log('OK  eliminar la cuenta borra sus registros en cascada y no toca a otra persona')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } })
    const left = await prisma.user.count({ where: { email: { contains: `${stamp}@example.test` } } })
    console.log(left === 0 ? 'Usuarios de prueba eliminados.' : `ATENCIÓN: quedaron ${left} usuarios de prueba`)
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
