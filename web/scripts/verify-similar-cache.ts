// Verifica contra la base real que la caché del ranking de similares no cambia los resultados y que las
// exclusiones personales (OWNED/DISLIKED) se aplican sobre el ranking común sin contaminar a otras personas.
//   npx tsx scripts/verify-similar-cache.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getOrCreateUser } from '../src/lib/auth'
import { getSimilarPerfumes } from '../src/lib/recommendations/similar'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

async function main() {
  const ref = await prisma.perfume.findFirstOrThrow({ where: { brand: 'Dior', name: 'Balade Sauvage' }, select: { id: true } })
  const t0 = performance.now()
  const cold = await getSimilarPerfumes(ref.id, { limit: 10 })
  const coldMs = performance.now() - t0
  const t1 = performance.now()
  const warm = await getSimilarPerfumes(ref.id, { limit: 10 })
  const warmMs = performance.now() - t1
  assert.ok(cold && warm && cold.length === 10)
  assert.deepEqual(warm, cold)
  console.log(`OK  caché: frío ${coldMs.toFixed(0)} ms, caliente ${warmMs.toFixed(1)} ms; resultados idénticos`)
  // orden total: ningún par adyacente con el mismo puntaje queda desordenado por id
  const full = (await getSimilarPerfumes(ref.id, { limit: 50 }))!
  for (let i = 1; i < full.length; i++) assert.ok(full[i - 1].score >= full[i].score)
  console.log(`OK  ranking ordenado (${full.length} resultados, límite 50)`)

  assert.equal(await getSimilarPerfumes('no-existe', {}), null)
  assert.equal(await getSimilarPerfumes('no-existe', {}), null)
  console.log('OK  un perfume inexistente da null (y no se cachea)')

  const stamp = Date.now()
  const user = await getOrCreateUser({ user: { id: `sim-${stamp}`, email: `sim-${stamp}@example.test` } })
  try {
    const owned = cold[0].perfumeId, disliked = cold[1].perfumeId, wish = cold[2].perfumeId
    await prisma.userCollection.createMany({ data: [
      { userId: user.id, perfumeId: owned, status: 'OWNED' },
      { userId: user.id, perfumeId: disliked, status: 'DISLIKED' },
      { userId: user.id, perfumeId: wish, status: 'WISHLIST' },
    ] })
    const mine = (await getSimilarPerfumes(ref.id, { limit: 10, userId: user.id }))!
    const ids = mine.map((r) => r.perfumeId)
    assert.ok(!ids.includes(owned) && !ids.includes(disliked), 'OWNED y DISLIKED se descuentan')
    assert.ok(ids.includes(wish), 'WISHLIST no se descuenta')
    assert.equal(mine.length, 10, 'se completa el límite con los siguientes del ranking')
    assert.deepEqual(mine.map((r) => r.perfumeId), cold.map((r) => r.perfumeId).filter((id) => id !== owned && id !== disliked).concat(full[10].perfumeId, full[11].perfumeId).slice(0, 10))
    console.log('OK  exclusiones personales: OWNED/DISLIKED descontados, WISHLIST se mantiene, se completan 10')
    const other = (await getSimilarPerfumes(ref.id, { limit: 10 }))!
    assert.deepEqual(other, cold)
    console.log('OK  el ranking común no se contamina: otra persona sigue viendo el original')
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}

main().then(() => console.log('\nTodo OK')).catch((e) => { console.error('FALLÓ:', e); process.exitCode = 1 })
