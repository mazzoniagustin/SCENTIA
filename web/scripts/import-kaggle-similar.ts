// Importa "me recuerda a" (votado por la comunidad) del dataset de Kaggle (ledecanteur, CC BY-NC-SA 4.0; ver /creditos).
//   npx tsx scripts/import-kaggle-similar.ts            simulación
//   npx tsx scripts/import-kaggle-similar.ts --apply    reemplaza TODA la tabla PerfumeSimilar
// Solo se guardan pares donde ambos perfumes están en el catálogo (se enlazan por sourceId = id de Fragrantica).
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'fs'
import readline from 'readline'
import { pickSimilar } from '../src/lib/import/similar'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })
const APPLY = process.argv.includes('--apply')
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

async function main() {
  console.log(APPLY ? '*** APLICANDO ***' : '*** SIMULACIÓN (agregá --apply para escribir) ***')
  const idBySource = new Map(
    (await prisma.perfume.findMany({ where: { sourceId: { not: null } }, select: { id: true, sourceId: true } })).map((p) => [p.sourceId!, p.id]),
  )
  console.log(`Perfumes del catálogo con id de Fragrantica: ${idBySource.size}`)

  const rows: Array<{ perfumeId: string; similarId: string; upVotes: number; downVotes: number; net: number }> = []
  const stats = { lines: 0, inCatalog: 0, withAny: 0, candidates: 0, targetMissing: 0 }
  const rl = readline.createInterface({ input: fs.createReadStream(path.resolve('data/perfumes.jsonl'), { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    stats.lines++
    let record: { id?: number | string; similar?: { reminds_me_of?: unknown } }
    try { record = JSON.parse(line) } catch { continue }
    const perfumeId = idBySource.get(String(record.id))
    if (!perfumeId) continue
    stats.inCatalog++
    const picked = pickSimilar(String(record.id), record.similar?.reminds_me_of)
    stats.candidates += picked.length
    let any = false
    for (const s of picked) {
      const similarId = idBySource.get(s.similarSourceId)
      if (!similarId) { stats.targetMissing++; continue }
      any = true
      rows.push({ perfumeId, similarId, upVotes: s.upVotes, downVotes: s.downVotes, net: s.net })
    }
    if (any) stats.withAny++
  }
  console.log('Resumen:', stats, `→ ${rows.length} pares para guardar`)

  if (!APPLY) return
  await prisma.perfumeSimilar.deleteMany({})
  for (const part of chunk(rows, 5000)) await prisma.perfumeSimilar.createMany({ data: part, skipDuplicates: true })
  console.log('Guardado:', await prisma.perfumeSimilar.count(), 'pares.')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
