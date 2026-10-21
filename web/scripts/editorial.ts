// Flujo editorial por scripts (RF-06): listar y cambiar el estado de publicación de perfumes. No hay panel admin en la app.
//   npx tsx scripts/editorial.ts list [--status draft|published] [--limit N] [--q texto]     solo lectura
//   npx tsx scripts/editorial.ts publish <id…> | --file ids.txt [--apply] [--force-large]    simulación sin --apply
//   npx tsx scripts/editorial.ts unpublish <id…> | --file ids.txt [--apply] [--force-large]
// Publicar exige procedencia (source y, si hay imagen, imageSource/imageSourceUrl con host permitido); despublicar siempre se puede.
// Con --apply escribe un registro en backups/editorial-<fecha>.jsonl (carpeta ignorada por git). Procedimiento: docs/editorial.md.
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import fs from 'fs'
import { PrismaClient, type PublicationStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { checkIdLimit, parseArgs, uniqueIds, MAX_IDS_PER_RUN } from '../src/lib/editorial/args'
import { parseIdList } from '../src/lib/editorial/ids'
import { provenanceProblems } from '../src/lib/editorial/provenance'

const USAGE = `Uso:
  npx tsx scripts/editorial.ts list [--status draft|published] [--limit N] [--q texto]
  npx tsx scripts/editorial.ts publish <id…> | --file ids.txt [--apply] [--force-large]
  npx tsx scripts/editorial.ts unpublish <id…> | --file ids.txt [--apply] [--force-large]`

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

async function list(status: PublicationStatus | null, limit: number, q: string | null) {
  const where = {
    ownerId: null,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ brand: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } }] } : {}),
  }
  const [rows, matching, byStatus, bySource] = await Promise.all([
    prisma.perfume.findMany({
      where, take: limit, orderBy: [{ brand: 'asc' }, { name: 'asc' }],
      select: { id: true, brand: true, name: true, status: true, source: true, imageSource: true },
    }),
    prisma.perfume.count({ where }),
    prisma.perfume.groupBy({ by: ['status'], where: { ownerId: null }, _count: { _all: true } }),
    prisma.perfume.groupBy({ by: ['source'], where: { ownerId: null }, _count: { _all: true } }),
  ])
  for (const r of rows) {
    console.log([r.id, r.brand, r.name, r.status, r.source ?? '-', r.imageSource ?? '-'].join(' | '))
  }
  console.log(`\nMostrando ${rows.length} de ${matching} que coinciden con el filtro.`)
  console.log('Conteo por estado:')
  for (const g of byStatus) console.log(`  ${g.status}: ${g._count._all}`)
  console.log('Conteo por source:')
  for (const g of bySource.sort((a, b) => b._count._all - a._count._all)) console.log(`  ${g.source ?? '(sin source)'}: ${g._count._all}`)
}

async function change(kind: 'publish' | 'unpublish', rawIds: string[], file: string | null, apply: boolean, forceLarge: boolean) {
  const target: PublicationStatus = kind === 'publish' ? 'PUBLISHED' : 'DRAFT'
  const opposite = kind === 'publish' ? 'unpublish' : 'publish'
  console.log(apply ? '*** APLICANDO ***' : '*** SIMULACIÓN (agregá --apply para escribir) ***')
  if (apply) console.log('Recordatorio: hacé el respaldo antes con `npx tsx scripts/backup-db.ts` (este script no lo ejecuta).')

  let ids = rawIds
  if (file) {
    if (!fs.existsSync(file)) { console.error(`No existe el archivo: ${file}`); process.exitCode = 1; return }
    ids = [...ids, ...parseIdList(fs.readFileSync(file, 'utf8'))]
  }
  ids = uniqueIds(ids)
  if (!ids.length) { console.error('No hay ids para procesar.'); process.exitCode = 1; return }
  const limitError = checkIdLimit(ids.length, forceLarge)
  if (limitError) { console.error(limitError); process.exitCode = 1; return }
  if (ids.length > MAX_IDS_PER_RUN) console.log(`Aviso: ${ids.length} ids (--force-large).`)

  const rows = await prisma.perfume.findMany({
    where: { id: { in: ids }, ownerId: null },
    select: { id: true, brand: true, name: true, status: true, source: true, imageUrl: true, imageSource: true, imageSourceUrl: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  const toChange: typeof rows = []
  const unchanged: string[] = []
  const rejected: Array<{ id: string; reason: string }> = []
  for (const id of ids) {
    const row = byId.get(id)
    if (!row) { rejected.push({ id, reason: 'no existe' }); continue }
    if (kind === 'publish') {
      const problems = provenanceProblems(row)
      if (problems.length) { rejected.push({ id, reason: `procedencia incompleta: ${problems.join(', ')}` }); continue }
    }
    if (row.status === target) { unchanged.push(id); continue }
    toChange.push(row)
  }

  for (const r of toChange) console.log(`  ${apply ? 'CAMBIA' : 'cambiaría'}: ${r.id} | ${r.brand} | ${r.name} | ${r.status} -> ${target}`)
  for (const id of unchanged) console.log(`  sin cambio (ya está ${target}): ${id}`)
  for (const r of rejected) console.log(`  RECHAZADO: ${r.id} | ${r.reason}`)

  let updated = 0
  let logFile: string | null = null
  if (apply && toChange.length) {
    // El filtro por estado previo evita pisar un cambio concurrente.
    const result = await prisma.perfume.updateMany({
      where: { id: { in: toChange.map((r) => r.id) }, ownerId: null, status: { not: target } },
      data: { status: target },
    })
    updated = result.count
    const now = new Date()
    const dir = path.resolve('backups')
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    logFile = path.join(dir, `editorial-${now.toISOString().replace(/[:.]/g, '-')}.jsonl`)
    fs.writeFileSync(
      logFile,
      toChange.map((r) => JSON.stringify({ at: now.toISOString(), action: kind, id: r.id, brand: r.brand, name: r.name, from: r.status, to: target })).join('\n') + '\n',
      { mode: 0o600 },
    )
  }

  console.log(`\nResumen: aceptados ${toChange.length} (${apply ? `actualizados ${updated}` : 'sin escribir'}), sin cambio ${unchanged.length}, rechazados ${rejected.length}, pedidos ${ids.length}.`)
  if (apply && toChange.length) {
    console.log(`Registro: ${logFile}`)
    console.log(`Reversión: npx tsx scripts/editorial.ts ${opposite} ${toChange.map((r) => r.id).join(' ')} --apply`)
  }
  if (!apply) console.log('(Simulación: no se cambió nada.)')
  if (rejected.length) process.exitCode = 1
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) { console.error(`${parsed.error}\n\n${USAGE}`); process.exitCode = 2; return }
  const c = parsed.command
  if (c.kind === 'list') await list(c.status, c.limit, c.q)
  else await change(c.kind, c.ids, c.file, c.apply, c.forceLarge)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
