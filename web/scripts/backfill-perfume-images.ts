// Completa imageUrl, imageSource e imageSourceUrl de los perfumes con los datos que ya tenemos en local
// (data/perfumes.jsonl del dataset de Kaggle, CC BY-NC-SA 4.0). NO hace requests de red: las imágenes se enlazan, no se copian.
//   npx tsx scripts/backfill-perfume-images.ts --dry-run     simulación (también es lo que pasa sin --apply)
//   npx tsx scripts/backfill-perfume-images.ts --apply       escribe, por lotes
// Idempotente: solo toca filas con imageSource vacío. Una imagen retirada a propósito (imageUrl NULL + imageSource 'removed',
// ver docs/imagenes.md) tiene imageSource, así que el script no la vuelve a poner. Valida que las URLs sean https y de un host permitido.
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { imageFieldsFromRecord, type ImageFields } from '../src/lib/images'
import { readLines } from '../src/lib/import/lines'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })
const APPLY = process.argv.includes('--apply') && !process.argv.includes('--dry-run')
const BATCH = 2000
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

async function main() {
  console.log(APPLY ? '*** APLICANDO ***' : '*** SIMULACIÓN (agregá --apply para escribir) ***')
  const rows = await prisma.perfume.findMany({ where: { sourceId: { not: null } }, select: { id: true, sourceId: true, imageSource: true } })
  const bySource = new Map(rows.map((r) => [r.sourceId!, r]))

  const stats = { lines: 0, invalidJson: 0, inCatalog: 0, noValidImage: 0, alreadyHandled: 0, toUpdate: 0, updated: 0 }
  const updates: Array<{ id: string } & ImageFields> = []
  for await (const line of readLines(path.resolve('data/perfumes.jsonl'))) {
    stats.lines++
    let record: { id?: number | string; picture?: unknown; url?: unknown }
    try { record = JSON.parse(line) } catch { stats.invalidJson++; continue }
    const row = bySource.get(String(record.id))
    if (!row) continue
    stats.inCatalog++
    const fields = imageFieldsFromRecord(record)
    if (!fields) { stats.noValidImage++; continue }
    if (row.imageSource !== null) { stats.alreadyHandled++; continue }
    updates.push({ id: row.id, ...fields })
  }
  stats.toUpdate = updates.length

  if (APPLY) {
    for (const part of chunk(updates, BATCH)) {
      stats.updated += await prisma.$executeRaw`
        UPDATE "Perfume" AS pf SET "imageUrl" = v.url, "imageSource" = v.src, "imageSourceUrl" = v.page, "updatedAt" = now()
        FROM unnest(${part.map((u) => u.id)}::text[], ${part.map((u) => u.imageUrl)}::text[],
                    ${part.map((u) => u.imageSource)}::text[], ${part.map((u) => u.imageSourceUrl)}::text[]) AS v(id, url, src, page)
        WHERE pf.id = v.id AND pf."imageSource" IS NULL`
    }
  }
  console.log('Resumen:', stats)
  const [withImage, total] = await Promise.all([prisma.perfume.count({ where: { imageUrl: { not: null } } }), prisma.perfume.count()])
  console.log(`Perfumes con imagen en la base: ${withImage} de ${total}`)
  if (!APPLY) console.log('(Simulación: no se cambió nada.)')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
