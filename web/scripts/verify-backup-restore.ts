// Prueba de punta a punta el ciclo respaldo → pérdida → restauración con un usuario de prueba descartable.
//   npx tsx scripts/verify-backup-restore.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })
const run = (script: string, ...args: string[]) =>
  execFileSync('npx', ['tsx', script, ...args], { encoding: 'utf8', env: process.env }).replace(/^npm.*\n/gm, '')

async function main() {
  const stamp = Date.now()
  const user = await prisma.user.create({ data: { email: `restore-${stamp}@example.test`, supabaseId: `restore-${stamp}` } })
  const perfume = await prisma.perfume.findFirstOrThrow({ select: { id: true } })
  await prisma.userCollection.create({ data: { userId: user.id, perfumeId: perfume.id, status: 'OWNED', rating: 5, personalNotes: 'nota que no debe perderse' } })
  await prisma.userProfile.create({ data: { userId: user.id, quizAnswers: { ambiente: 'mar', familias: ['floral'] }, quizVersion: 1, locale: 'en', country: 'AR' } })
  // Un perfume propio (irreemplazable: no viene de ninguna importación) con su acorde y su entrada de colección.
  const accord = await prisma.accord.findFirstOrThrow({ select: { id: true } })
  const own = await prisma.perfume.create({
    data: {
      id: `restore-own-${stamp}`, brand: '', name: `Propio ${stamp}`, gender: 'unisex', status: 'PRIVATE', ownerId: user.id,
      topNotes: ['Limón'], imageUrl: `restore-${stamp}/foto.webp`, longevity: 4, accords: { create: [{ accordId: accord.id, intensity: 70 }] },
    },
  })
  await prisma.userCollection.create({ data: { userId: user.id, perfumeId: own.id, status: 'OWNED', personalNotes: 'mi perfume propio' } })
  let dir = ''
  try {
    const out = run('scripts/backup-db.ts', '--user-data')
    dir = out.match(/Respaldo en (\S+)/)![1]
    console.log(`OK  respaldo creado en ${dir}`)

    await prisma.user.delete({ where: { id: user.id } }) // pérdida simulada (la colección y el perfil caen en cascada)
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
    assert.equal(await prisma.userCollection.count({ where: { userId: user.id } }), 0)
    assert.equal(await prisma.perfume.count({ where: { id: own.id } }), 0)
    console.log('OK  pérdida simulada: usuario, colección, perfil y perfume propio borrados')

    console.log(run('scripts/restore-db.ts', dir).split('\n').filter(Boolean).map((l) => '    ' + l).join('\n'))
    const back = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { collections: true, profile: true } })
    assert.equal(back.email, `restore-${stamp}@example.test`)
    assert.equal(back.collections[0].personalNotes, 'nota que no debe perderse')
    assert.equal(back.collections[0].status, 'OWNED')
    assert.deepEqual(back.profile?.quizAnswers, { ambiente: 'mar', familias: ['floral'] })
    assert.equal(back.profile?.locale, 'en')
    console.log('OK  restauración: usuario, colección (con su nota privada) y perfil recuperados con los mismos valores')

    const ownBack = await prisma.perfume.findUniqueOrThrow({ where: { id: own.id }, include: { accords: true } })
    assert.equal(ownBack.status, 'PRIVATE')
    assert.equal(ownBack.ownerId, user.id)
    assert.deepEqual([ownBack.topNotes, ownBack.imageUrl, ownBack.longevity], [['Limón'], `restore-${stamp}/foto.webp`, 4])
    assert.deepEqual(ownBack.accords.map((a) => [a.accordId, a.intensity]), [[accord.id, 70]])
    assert.equal(back.collections.find((c) => c.perfumeId === own.id)?.personalNotes, 'mi perfume propio')
    console.log('OK  restauración: el perfume propio vuelve con su dueño, notas, foto, acorde y entrada de colección')

    const again = run('scripts/restore-db.ts', dir)
    assert.match(again, /User\s+\d+ en el respaldo \|\s+0 insertadas/)
    console.log('OK  restaurar de nuevo es inofensivo: 0 filas insertadas, nada se pisa')
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } })
    if (dir) fs.rmSync(dir, { recursive: true, force: true }) // solo el respaldo de esta prueba
    await prisma.$disconnect()
  }
}

main().then(() => console.log('\nTodo OK')).catch((e) => { console.error('FALLÓ:', e); process.exitCode = 1 })
