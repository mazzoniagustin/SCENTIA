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
  let dir = ''
  try {
    const out = run('scripts/backup-db.ts', '--user-data')
    dir = out.match(/Respaldo en (\S+)/)![1]
    console.log(`OK  respaldo creado en ${dir}`)

    await prisma.user.delete({ where: { id: user.id } }) // pérdida simulada (la colección y el perfil caen en cascada)
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 0)
    assert.equal(await prisma.userCollection.count({ where: { userId: user.id } }), 0)
    console.log('OK  pérdida simulada: usuario, colección y perfil borrados')

    console.log(run('scripts/restore-db.ts', dir).split('\n').filter(Boolean).map((l) => '    ' + l).join('\n'))
    const back = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { collections: true, profile: true } })
    assert.equal(back.email, `restore-${stamp}@example.test`)
    assert.equal(back.collections[0].personalNotes, 'nota que no debe perderse')
    assert.equal(back.collections[0].status, 'OWNED')
    assert.deepEqual(back.profile?.quizAnswers, { ambiente: 'mar', familias: ['floral'] })
    assert.equal(back.profile?.locale, 'en')
    console.log('OK  restauración: usuario, colección (con su nota privada) y perfil recuperados con los mismos valores')

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
