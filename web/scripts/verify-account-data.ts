// Verifica contra la base real la capa de datos personales (perfil del quiz, preferencias,
// exportación y eliminación en cascada) con un usuario de prueba que se crea y se elimina.
//   npx tsx scripts/verify-account-data.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getOrCreateUser } from '../src/lib/auth'
import { deleteUserData, exportUserData, getUserProfile, savePreferences, saveQuizAnswers } from '../src/lib/account/data'
import { validatePreferences } from '../src/lib/account/preferences'
import { assignInitialNickname, isNicknameTaken, saveNickname } from '../src/lib/account/nickname-data'
import { QUIZ_VERSION, type QuizAnswers } from '../src/lib/quiz/questions'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

const answers: QuizAnswers = {
  ambiente: 'mar', estacion: 'verano', ocasion: 'deporte', dulzor: 'nada', estilo: 'suave',
  familias: ['citrico'], evitar: ['oud'],
}

async function main() {
  const stamp = Date.now()
  const user = await getOrCreateUser({ user: { id: `verify-${stamp}`, email: `verify-${stamp}@example.test` } })
  const other = await getOrCreateUser({ user: { id: `verify-other-${stamp}`, email: `verify-other-${stamp}@example.test` } })
  try {
    // Perfil del quiz: ida y vuelta, y una versión vieja se ignora.
    // Sin apodo en los metadatos, el primer ingreso asigna uno temporal (crea la fila de perfil), sin respuestas del quiz.
    assert.equal((await getUserProfile(user.id))?.answers ?? null, null)
    await saveQuizAnswers(user.id, answers)
    assert.deepEqual((await getUserProfile(user.id))?.answers, answers)
    console.log('OK  perfil del quiz: guardar y leer')

    await prisma.userProfile.update({ where: { userId: user.id }, data: { quizVersion: QUIZ_VERSION + 1 } })
    assert.equal((await getUserProfile(user.id))?.answers, null)
    await saveQuizAnswers(user.id, answers)
    console.log('OK  versión vieja del quiz se ignora; re-guardar la restaura')

    // Preferencias (RF-08)
    const prefs = validatePreferences({ locale: 'en', country: 'ar', currency: 'ars' })
    assert.ok(prefs.ok)
    await savePreferences(user.id, prefs.value)
    assert.deepEqual((await getUserProfile(user.id))?.preferences, { locale: 'en', country: 'AR', currency: 'ARS' })
    assert.deepEqual((await getUserProfile(user.id))?.answers, answers, 'guardar preferencias no pierde el quiz')
    console.log('OK  preferencias: guardar y leer sin perder el quiz')

    // Apodo (registro con magic link): se valida de nuevo en el servidor; la unicidad la da el índice sobre lower("nickname").
    const wanted = `Vfy${stamp}`
    const nickUsers = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((tag) => getOrCreateUser({ user: { id: `verify-nick-${tag}-${stamp}`, email: `verify-nick-${tag}-${stamp}@example.test` } })),
    )
    const [nickA, nickB, nickC, nickD, nickE] = nickUsers
    try {
      const nick = async (id: string) => prisma.userProfile.findUnique({ where: { userId: id }, select: { nickname: true, nicknameIsTemporary: true } })

      assert.equal((await nick(nickA.id))?.nicknameIsTemporary, true, 'sin apodo en los metadatos → temporal')
      await prisma.userProfile.deleteMany({ where: { userId: { in: nickUsers.map((u) => u.id) } } }) // partimos sin apodos
      console.log('OK  sin apodo en los metadatos se asigna uno temporal')

      await assignInitialNickname(nickA.id, wanted)
      assert.deepEqual(await nick(nickA.id), { nickname: wanted, nicknameIsTemporary: false })
      console.log('OK  primer ingreso: apodo válido guardado tal cual')

      await assignInitialNickname(nickB.id, wanted.toLowerCase())
      const b = await nick(nickB.id)
      assert.equal(b?.nicknameIsTemporary, true, 'mismo apodo con otras mayúsculas → temporal')
      assert.match(b?.nickname ?? '', /^perfumista-[a-z0-9]{6}$/)
      assert.equal(await isNicknameTaken(wanted.toUpperCase()), true)
      console.log('OK  apodo tomado (otra capitalización): se asigna uno temporal; isNicknameTaken no distingue mayúsculas')

      for (const [target, bad] of [[nickC, 'x'], [nickD, 'ADMIN'], [nickE, { nickname: 'objeto' }]] as const) {
        await assignInitialNickname(target.id, bad)
        assert.equal((await nick(target.id))?.nicknameIsTemporary, true, `inválido o reservado → temporal: ${JSON.stringify(bad)}`)
      }
      console.log('OK  apodo inválido, reservado o que no es texto: temporal')

      await assignInitialNickname(nickA.id, 'OtroApodo123')
      assert.equal((await nick(nickA.id))?.nickname, wanted, 'no pisa un apodo existente')
      console.log('OK  un segundo ingreso no pisa el apodo guardado')

      // Carrera: dos personas piden el mismo apodo a la vez → una lo obtiene, la otra queda con uno temporal.
      const race = `Race${stamp}`
      await prisma.userProfile.deleteMany({ where: { userId: { in: [nickC.id, nickD.id] } } })
      await Promise.all([assignInitialNickname(nickC.id, race), assignInitialNickname(nickD.id, race)])
      const raced = [await nick(nickC.id), await nick(nickD.id)]
      assert.equal(raced.filter((r) => r?.nickname === race && !r.nicknameIsTemporary).length, 1, 'exactamente una gana el apodo')
      assert.equal(raced.filter((r) => r?.nicknameIsTemporary).length, 1, 'la otra recibe uno temporal')
      console.log('OK  carrera por el mismo apodo: gana una sola persona; la otra recibe uno temporal')

      // Edición desde Cuenta
      assert.equal(await saveNickname(nickB.id, wanted.toUpperCase()), 'taken')
      assert.equal(await saveNickname(nickB.id, `New${stamp}`), 'ok')
      assert.deepEqual(await nick(nickB.id), { nickname: `New${stamp}`, nicknameIsTemporary: false })
      assert.equal(await saveNickname(nickA.id, wanted.toUpperCase()), 'ok', 'cambiar solo las mayúsculas del propio apodo es válido')
      console.log('OK  editar: apodo ajeno → taken, libre → ok, mismo apodo con otras mayúsculas → ok')

      // La base también rechaza lo que el servidor no dejaría pasar
      await assert.rejects(prisma.userProfile.update({ where: { userId: nickB.id }, data: { nickname: 'a b' } }), 'CHECK de formato')
      console.log('OK  el CHECK de formato de la base rechaza un apodo inválido')

      // Exportación y liberación al borrar
      const exportedNick = await exportUserData(nickA.id)
      assert.equal(exportedNick?.profile?.nickname, wanted.toUpperCase())
      await deleteUserData(nickA.id)
      assert.equal(await isNicknameTaken(wanted), false)
      console.log('OK  la exportación incluye el apodo y al borrar la cuenta el apodo queda libre')
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: nickUsers.map((u) => u.id) } } })
    }

    // Exportación (RF-05): solo datos propios
    const perfume = await prisma.perfume.findFirstOrThrow({ select: { id: true, brand: true, name: true } })
    await prisma.userCollection.create({ data: { userId: user.id, perfumeId: perfume.id, status: 'OWNED', rating: 4, personalNotes: 'nota privada' } })
    await prisma.userCollection.create({ data: { userId: other.id, perfumeId: perfume.id, status: 'WISHLIST', personalNotes: 'AJENA' } })
    const exported = await exportUserData(user.id)
    assert.ok(exported)
    assert.equal(exported.user.email, user.email)
    assert.equal(exported.collection.length, 1)
    assert.equal(exported.collection[0].personalNotes, 'nota privada')
    assert.equal(exported.collection[0].perfume.name, perfume.name)
    assert.ok(!JSON.stringify(exported).includes('AJENA'), 'la exportación no contiene datos de otra persona')
    assert.deepEqual(exported.profile?.quizAnswers, answers)
    console.log('OK  exportación: perfil, preferencias y colección propios; nada ajeno')
    console.log('    claves:', Object.keys(exported).join(', '), '| colección:', exported.collection.length)

    // Eliminación en cascada
    const deleted = await deleteUserData(user.id)
    assert.deepEqual(deleted, { collection: 1, profile: 1 })
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
    assert.equal(await prisma.userCollection.count({ where: { userId: user.id } }), 0)
    assert.equal(await prisma.userProfile.count({ where: { userId: user.id } }), 0)
    assert.equal(await prisma.userCollection.count({ where: { userId: other.id } }), 1, 'la colección de otra persona no se toca')
    console.log('OK  eliminación: cuenta, colección y perfil borrados en cascada; los datos de otra persona intactos')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } }) // limpieza del usuario de prueba
    await prisma.$disconnect()
  }
}

main().then(() => console.log('\nTodo OK')).catch((e) => { console.error('FALLÓ:', e); process.exitCode = 1 })
