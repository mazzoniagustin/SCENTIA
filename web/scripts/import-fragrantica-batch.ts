// Import por lotes de Fragrantica. Uso:
//   npx tsx scripts/import-fragrantica-batch.ts --limit 500 [--offset 0] [--batch 500] [--as-draft]
//   --as-draft: los perfumes NUEVOS entran como DRAFT (los existentes no cambian de estado); se publican con scripts/editorial.ts publish.
//   npx tsx scripts/import-fragrantica-batch.ts --all        (importación completa; requiere aprobación)
// Idempotente: upsert lógico por (brand, name) y relaciones reescritas. Nunca toca priceTier.
// El CSV se decodifica como Windows-1252 y los perfumistas se humanizan (ver humanize.ts).
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import { ACCORD_TRANSLATIONS } from './accord-translations'
import { creationStatus } from '../src/lib/import/creation-status'
import { humanize, humanizeBrand, humanizePerfumers, parseConcentration } from './humanize'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

const GENDER_MAP: Record<string, string> = { women: 'femenino', men: 'masculino', unisex: 'unisex' }
const INTENSITY = [100, 80, 60, 40, 20]
// Procedencia de los datos importados (RF-06).
const SOURCE = 'fragrantica-csv'
const AS_DRAFT = process.argv.includes('--as-draft')

type CsvRow = Record<string, string>
type NoteType = 'top' | 'heart' | 'base'
interface Prepared {
  brand: string
  name: string
  gender: string
  concentration: string | null
  releaseYear: number | null
  perfumer: string | null
  ratingValue: number | null
  ratingCount: number | null
  notes: Array<{ name: string; type: NoteType }>
  accords: Array<{ name: string; intensity: number }>
}

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const clean = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t && t.toLowerCase() !== 'unknown' ? t : ''
}
const key = (brand: string, name: string) => `${brand}\u0000${name}`
const chunk = <T,>(xs: T[], n: number) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

function prepare(row: CsvRow): Prepared | null {
  const brandSlug = clean(row.Brand)
  const nameSlug = clean(row.Perfume)
  if (!brandSlug || !nameSlug) return null

  const year = parseInt(row.Year, 10)
  const perfumer = [clean(row.Perfumer1), clean(row.Perfumer2)].filter(Boolean).join(', ')

  // Notas: dedupe por (nombre, tipo); el primer tipo en aparecer define la categoría global.
  const seen = new Set<string>()
  const notes: Prepared['notes'] = []
  for (const [col, type] of [['Top', 'top'], ['Middle', 'heart'], ['Base', 'base']] as const) {
    for (const raw of (row[col] ?? '').split(',')) {
      const n = clean(raw).toLowerCase()
      if (!n || seen.has(`${n}|${type}`)) continue
      seen.add(`${n}|${type}`)
      notes.push({ name: n, type })
    }
  }

  // Acordes: dos acordes en inglés pueden traducirse igual; se conserva el primero (mayor intensidad).
  const accordSeen = new Set<string>()
  const accords: Prepared['accords'] = []
  for (let j = 1; j <= 5; j++) {
    const eng = clean(row[`mainaccord${j}`])
    if (!eng) continue
    const es = ACCORD_TRANSLATIONS[eng] || eng
    if (accordSeen.has(es)) continue
    accordSeen.add(es)
    accords.push({ name: es, intensity: INTENSITY[j - 1] })
  }

  // "Rating Value" viene con coma decimal ("1,42"); fuera de 0-5 o ilegible → sin dato.
  const ratingValue = parseFloat(clean(row['Rating Value']).replace(',', '.'))
  const ratingCount = parseInt(clean(row['Rating Count']), 10)

  return {
    brand: humanizeBrand(brandSlug),
    name: humanize(nameSlug),
    gender: GENDER_MAP[clean(row.Gender).toLowerCase()] ?? 'unisex',
    concentration: parseConcentration(nameSlug),
    releaseYear: Number.isFinite(year) ? year : null,
    perfumer: perfumer ? humanizePerfumers(perfumer) : null,
    ratingValue: Number.isFinite(ratingValue) && ratingValue >= 0 && ratingValue <= 5 ? ratingValue : null,
    ratingCount: Number.isFinite(ratingCount) && ratingCount >= 0 ? ratingCount : null,
    notes,
    accords,
  }
}

async function importBatch(batch: Prepared[], noteIds: Map<string, string>, accordIds: Map<string, string>) {
  // 1) Note/Accord nuevos: un createMany y se actualiza el Map (sin upserts por fila).
  const noteCat = new Map<string, string>()
  const newAccords = new Set<string>()
  for (const p of batch) {
    for (const n of p.notes) if (!noteIds.has(n.name) && !noteCat.has(n.name)) noteCat.set(n.name, n.type)
    for (const a of p.accords) if (!accordIds.has(a.name)) newAccords.add(a.name)
  }
  if (noteCat.size) {
    await prisma.note.createMany({
      data: [...noteCat].map(([name, category]) => ({ name, category })),
      skipDuplicates: true,
    })
    for (const n of await prisma.note.findMany({ where: { name: { in: [...noteCat.keys()] } } })) noteIds.set(n.name, n.id)
  }
  if (newAccords.size) {
    await prisma.accord.createMany({ data: [...newAccords].map((name) => ({ name })), skipDuplicates: true })
    for (const a of await prisma.accord.findMany({ where: { name: { in: [...newAccords] } } })) accordIds.set(a.name, a.id)
  }

  // 2) Perfumes: crear los nuevos en bloque; los existentes se actualizan (sin priceTier).
  const existing = await prisma.perfume.findMany({
    where: { ownerId: null, OR: batch.map((p) => ({ brand: p.brand, name: p.name })) },
    select: { id: true, brand: true, name: true },
  })
  const ids = new Map(existing.map((e) => [key(e.brand, e.name), e.id]))
  const fresh = batch.filter((p) => !ids.has(key(p.brand, p.name)))
  const data = (p: Prepared) => ({
    gender: p.gender,
    concentration: p.concentration,
    releaseYear: p.releaseYear,
    perfumer: p.perfumer,
    ratingValue: p.ratingValue,
    ratingCount: p.ratingCount,
    source: SOURCE,
  })
  if (fresh.length) {
    await prisma.perfume.createMany({
      data: fresh.map((p) => ({ brand: p.brand, name: p.name, ...data(p), ...creationStatus(AS_DRAFT) })),
      skipDuplicates: true,
    })
    const created = await prisma.perfume.findMany({
      where: { ownerId: null, OR: fresh.map((p) => ({ brand: p.brand, name: p.name })) },
      select: { id: true, brand: true, name: true },
    })
    for (const c of created) ids.set(key(c.brand, c.name), c.id)
  }
  const toUpdate = batch.filter((p) => existing.some((e) => e.brand === p.brand && e.name === p.name))
  if (toUpdate.length) {
    // Un solo UPDATE ... FROM unnest: completa solo campos vacíos, nunca pisa datos curados ni priceTier.
    const col = <T,>(f: (p: Prepared) => T) => toUpdate.map(f)
    await prisma.$executeRaw`
      UPDATE "Perfume" AS pf SET
        concentration = COALESCE(pf.concentration, v.concentration),
        "releaseYear" = COALESCE(pf."releaseYear", v.year),
        -- Filas curadas (con priceTier) solo completan lo vacío; el resto toma el valor del CSV.
        perfumer = CASE WHEN pf."priceTier" IS NULL THEN COALESCE(v.perfumer, pf.perfumer)
                        ELSE COALESCE(pf.perfumer, v.perfumer) END,
        "ratingValue" = COALESCE(v.rating_value, pf."ratingValue"),
        "ratingCount" = COALESCE(v.rating_count, pf."ratingCount"),
        source = COALESCE(pf.source, ${SOURCE}),
        "updatedAt" = now()
      FROM unnest(${col((p) => ids.get(key(p.brand, p.name))!)}::text[],
                  ${col((p) => p.concentration)}::text[],
                  ${col((p) => p.releaseYear)}::int[],
                  ${col((p) => p.perfumer)}::text[],
                  ${col((p) => p.ratingValue)}::float8[],
                  ${col((p) => p.ratingCount)}::int[]) AS v(id, concentration, year, perfumer, rating_value, rating_count)
      WHERE pf.id = v.id`
  }

  // 3) Relaciones: borrar las de los existentes y crear todas de una vez, en una transacción.
  const perfumeIds = batch.map((p) => ids.get(key(p.brand, p.name))!).filter(Boolean)
  const noteRows = batch.flatMap((p) =>
    p.notes.map((n) => ({ perfumeId: ids.get(key(p.brand, p.name))!, noteId: noteIds.get(n.name)!, noteType: n.type })),
  )
  const accordRows = batch.flatMap((p) =>
    p.accords.map((a) => ({ perfumeId: ids.get(key(p.brand, p.name))!, accordId: accordIds.get(a.name)!, intensity: a.intensity })),
  )
  await prisma.$transaction([
    prisma.perfumeNote.deleteMany({ where: { perfumeId: { in: perfumeIds } } }),
    prisma.perfumeAccord.deleteMany({ where: { perfumeId: { in: perfumeIds } } }),
    prisma.perfumeNote.createMany({ data: noteRows, skipDuplicates: true }),
    prisma.perfumeAccord.createMany({ data: accordRows, skipDuplicates: true }),
  ])
  return { created: fresh.length, updated: toUpdate.length, notes: noteRows.length, accords: accordRows.length }
}

async function run() {
  const all = process.argv.includes('--all')
  const limit = all ? Infinity : parseInt(arg('--limit') ?? '', 10)
  if (!all && !Number.isFinite(limit)) throw new Error('Indicá --limit N (o --all para la importación completa).')
  const offset = parseInt(arg('--offset') ?? '0', 10)
  const batchSize = parseInt(arg('--batch') ?? '500', 10)

  // El CSV está en Windows-1252 (no UTF-8): leerlo como UTF-8 corrompe los acentos en "�".
  const csv = new TextDecoder('windows-1252').decode(fs.readFileSync(path.resolve('data/fra_cleaned.csv')))
  const rows = parse(csv, {
    delimiter: ';', columns: true, skip_empty_lines: true,
  }) as CsvRow[]

  // Dedupe por clave humanizada: si dos slugs colapsan en el mismo (brand, name) gana el primero.
  const byKey = new Map<string, Prepared>()
  let skipped = 0
  for (const r of rows.slice(offset, all ? undefined : offset + limit)) {
    const p = prepare(r)
    if (!p) { skipped++; continue }
    if (byKey.has(key(p.brand, p.name))) { skipped++; continue }
    byKey.set(key(p.brand, p.name), p)
  }
  const prepared = [...byKey.values()]

  const noteIds = new Map((await prisma.note.findMany({ select: { id: true, name: true } })).map((n) => [n.name, n.id]))
  const accordIds = new Map((await prisma.accord.findMany({ select: { id: true, name: true } })).map((a) => [a.name, a.id]))

  if (AS_DRAFT) console.log('--as-draft: los perfumes nuevos entran como DRAFT; los existentes no cambian de estado.')
  const t0 = Date.now()
  const totals = { created: 0, updated: 0, notes: 0, accords: 0 }
  for (const [i, batch] of chunk(prepared, batchSize).entries()) {
    const tb = Date.now()
    const r = await importBatch(batch, noteIds, accordIds)
    totals.created += r.created; totals.updated += r.updated; totals.notes += r.notes; totals.accords += r.accords
    console.log(`lote ${i + 1}: ${batch.length} filas en ${((Date.now() - tb) / 1000).toFixed(1)}s (nuevas ${r.created}, actualizadas ${r.updated})`)
  }
  const secs = (Date.now() - t0) / 1000
  if (AS_DRAFT) console.log(`Creados como DRAFT: ${totals.created}. Para publicarlos: npx tsx scripts/editorial.ts publish --file <ids.txt> (revisalos con list --status draft).`)
  console.log({ ...totals, filas: prepared.length, omitidas: skipped, segundos: +secs.toFixed(1), filasPorSeg: +(prepared.length / secs).toFixed(1) })
}

run().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
