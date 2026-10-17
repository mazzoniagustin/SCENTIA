// Verifica contra la base real el perfume del día: pick general, cambio por día y hemisferio,
// personalización con perfil guardado y exclusión de lo ya poseído. Usa un usuario de prueba que se elimina.
//   npx tsx scripts/verify-daily.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getOrCreateUser } from '../src/lib/auth'
import { saveQuizAnswers, savePreferences } from '../src/lib/account/data'
import { getDailyPerfume } from '../src/lib/daily/pick'
import type { QuizAnswers } from '../src/lib/quiz/questions'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })
const answers: QuizAnswers = {
  ambiente: 'jardin', estacion: 'entretiempo', ocasion: 'formal', dulzor: 'algo', estilo: 'suave',
  duracion: 'cualquiera', estela: 'cualquiera', favoritos: [],
  familias: ['floral'], evitar: ['oud'],
}
const noon = (iso: string) => new Date(`${iso}T15:00:00Z`)

async function main() {
  // 1) General: de la estación, bien valorado, estable en el día y distinto entre días
  const day = noon('2026-10-08')
  const a = await getDailyPerfume({ date: day })
  const b = await getDailyPerfume({ date: day })
  assert.ok(a && b)
  assert.equal(a.perfumeId, b.perfumeId)
  assert.equal(a.season, 'primavera') // 8/oct en el hemisferio sur
  const row = await prisma.perfume.findUniqueOrThrow({ where: { id: a.perfumeId } })
  assert.ok(row.seasons.includes('primavera') && row.status === 'PUBLISHED')
  assert.ok((row.ratingCount ?? 0) >= 1000 && (row.ratingValue ?? 0) >= 3.8)
  console.log(`OK  general (8/oct, sur): ${a.brand} — ${a.name} | ${row.ratingValue} (${row.ratingCount} val.) | ${a.accords.join(', ')}`)

  const picks: string[] = []
  for (let d = 1; d <= 14; d++) {
    const p = await getDailyPerfume({ date: noon(`2026-10-${String(d).padStart(2, '0')}`) })
    picks.push(`${p!.brand} — ${p!.name}`)
  }
  assert.ok(new Set(picks).size >= 13, 'los días consecutivos deben variar')
  console.log(`OK  14 días consecutivos: ${new Set(picks).size} perfumes distintos. Primeros: ${picks.slice(0, 3).join(' | ')}`)

  // 2) Estación y hemisferio
  const eneroSur = await getDailyPerfume({ date: noon('2026-01-15') })
  assert.equal(eneroSur?.season, 'verano')
  console.log(`OK  15/ene (sur) → ${eneroSur?.season}: ${eneroSur?.brand} — ${eneroSur?.name}`)

  // 3) Con perfil guardado: personalizado, de la estación, y país cambia el hemisferio
  const stamp = Date.now()
  const user = await getOrCreateUser({ user: { id: `daily-${stamp}`, email: `daily-${stamp}@example.test` } })
  try {
    await saveQuizAnswers(user.id, answers)
    const p = await getDailyPerfume({ userId: user.id, date: day })
    assert.ok(p && p.personalized && p.reasons.includes('matches_profile') && p.matchedAccords.length > 0)
    const prow = await prisma.perfume.findUniqueOrThrow({ where: { id: p.perfumeId } })
    assert.ok(prow.seasons.includes('primavera'))
    console.log(`OK  personalizado (floral/suave): ${p.brand} — ${p.name} | coincide en ${p.matchedAccords.join(', ')}`)

    await savePreferences(user.id, { locale: 'es', country: 'ES', currency: null })
    const norte = await getDailyPerfume({ userId: user.id, date: day })
    assert.equal(norte?.season, 'otoño')
    assert.equal(norte?.hemisphere, 'north')
    console.log(`OK  país ES → hemisferio norte, ${norte?.season}: ${norte?.brand} — ${norte?.name}`)

    // 4) Lo que ya tenés no es el perfume del día
    await prisma.userCollection.create({ data: { userId: user.id, perfumeId: norte!.perfumeId, status: 'OWNED' } })
    const sinOwned = await getDailyPerfume({ userId: user.id, date: day })
    assert.notEqual(sinOwned?.perfumeId, norte!.perfumeId)
    console.log(`OK  excluye lo que ya tenés: antes ${norte?.name} → ahora ${sinOwned?.name}`)
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}

main().then(() => console.log('\nTodo OK')).catch((e) => { console.error('FALLÓ:', e); process.exitCode = 1 })
