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
    assert.equal(await getUserProfile(user.id), null)
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
