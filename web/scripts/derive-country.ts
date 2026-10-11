// Completa Perfume.country con la columna Country de data/fra_cleaned.csv (base del filtro "Origen árabe").
//
//   npx tsx scripts/derive-country.ts                 simulación (no escribe nada)
//   npx tsx scripts/derive-country.ts --apply         escribe
//   npx tsx scripts/derive-country.ts --top 100       cuántas marcas listar en los resúmenes (40 por defecto)
//
// 1) Directo: cada perfume con country NULL toma el país de su fila del CSV (por sourceId; si no tiene, por marca + nombre).
// 2) Inferido por marca: los que siguen sin país toman el de su marca solo si TODAS las filas resueltas de esa marca
//    coinciden (con el mismo país). Se informa en una sección aparte.
// Nunca pisa un country existente: se puede repetir. Haga un respaldo antes (scripts/backup-db.ts).
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { parse as parseSync } from 'csv-parse/sync'
import fs from 'fs'
import { humanize, humanizeBrand } from './humanize'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

const APPLY = process.argv.includes('--apply')
const TOP = (() => {
  const i = process.argv.indexOf('--top')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) || 40 : 40
})()

type CsvRow = { url?: string; Perfume?: string; Brand?: string; Country?: string }

const key = (brand: string, name: string) => `${brand}\u0000${name}`
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const clean = (v: string | undefined) => (v ?? '').trim()
// País tal cual el CSV, sin traducir; solo se recortan espacios. Vacío o "unknown" no cuentan.
const normalizeCountry = (v: string | undefined) => {
  const country = clean(v).replace(/\s+/g, ' ')
  return country && country.toLowerCase() !== 'unknown' ? country : null
}

function countBy<T>(items: T[], pick: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(pick(item), (counts.get(pick(item)) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function printTable(title: string, rows: Array<[string, number]>, limit = Infinity) {
  console.log(`\n${title} (${rows.length})`)
  for (const [label, n] of rows.slice(0, limit)) console.log(`  ${String(n).padStart(6)}  ${label}`)
  if (rows.length > limit) console.log(`  … y ${rows.length - limit} más (--top N para ver más)`)
}

async function writeCountries(updates: Array<{ id: string; country: string }>) {
  for (const part of chunk(updates, 2000)) {
    await prisma.$executeRaw`
      UPDATE "Perfume" AS pf SET country = v.c
      FROM unnest(${part.map((x) => x.id)}::text[], ${part.map((x) => x.country)}::text[]) AS v(id, c)
      WHERE pf.id = v.id AND pf.country IS NULL`
  }
}

async function main() {
  console.log(APPLY ? '*** APLICANDO cambios ***' : '*** SIMULACIÓN: no se escribe nada (agregá --apply) ***')

  const perfumes = await prisma.perfume.findMany({ select: { id: true, brand: true, name: true, sourceId: true, country: true } })
  const csv = new TextDecoder('windows-1252').decode(fs.readFileSync(path.resolve('data/fra_cleaned.csv')))
  const rows = parseSync(csv, { delimiter: ';', columns: true, skip_empty_lines: true }) as CsvRow[]

  const countryBySource = new Map<string, string>()
  const countryByKey = new Map<string, string>()
  for (const row of rows) {
    const country = normalizeCountry(row.Country)
    if (!country) continue
    const m = /-(\d+)\.html/.exec(row.url ?? '')
    if (m) countryBySource.set(m[1], country)
    const brandSlug = clean(row.Brand)
    const nameSlug = clean(row.Perfume)
    if (brandSlug && nameSlug) countryByKey.set(key(humanizeBrand(brandSlug), humanize(nameSlug)), country)
  }

  // 1) Directo
  const pending = perfumes.filter((p) => p.country === null)
  const direct: Array<{ id: string; brand: string; country: string }> = []
  const unresolved: typeof pending = []
  for (const p of pending) {
    const country = (p.sourceId ? countryBySource.get(p.sourceId) : undefined) ?? countryByKey.get(key(p.brand, p.name))
    if (country) direct.push({ id: p.id, brand: p.brand, country })
    else unresolved.push(p)
  }

  console.log(`\nPerfumes: ${perfumes.length} · con country NULL: ${pending.length} · ya con country: ${perfumes.length - pending.length}`)
  console.log(`Filas del CSV: ${rows.length} (con país válido: ${countryBySource.size} por id de Fragrantica)`)
  console.log(`Resueltos directo: ${direct.length} · sin match en el CSV: ${unresolved.length}`)
  printTable('Directo: perfumes por país', countBy(direct, (x) => x.country))
  printTable('Directo: perfumes por marca', countBy(direct, (x) => `${x.brand} — ${x.country}`), TOP)

  // Evidencia por marca: países de los perfumes ya resueltos (los que ya tenían country en la base y los de este paso).
  const evidence = new Map<string, Map<string, number>>()
  const addEvidence = (brand: string, country: string) => {
    const byCountry = evidence.get(brand) ?? new Map<string, number>()
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1)
    evidence.set(brand, byCountry)
  }
  for (const p of perfumes) if (p.country) addEvidence(p.brand, p.country)
  for (const x of direct) addEvidence(x.brand, x.country)

  const conflicts = [...evidence.entries()].filter(([, byCountry]) => byCountry.size > 1)
  if (conflicts.length > 0) {
    console.log(`\nAdvertencia: marcas con más de un país en el CSV (no se infiere nada para ellas) (${conflicts.length})`)
    for (const [brand, byCountry] of conflicts.slice(0, TOP)) {
      console.log(`  ${brand}: ${[...byCountry.entries()].map(([c, n]) => `${c} ×${n}`).join(', ')}`)
    }
  }

  // 2) Inferido por marca (sección aparte)
  const inferred: Array<{ id: string; brand: string; country: string }> = []
  const stillUnknown: typeof unresolved = []
  for (const p of unresolved) {
    const byCountry = evidence.get(p.brand)
    if (byCountry && byCountry.size === 1) inferred.push({ id: p.id, brand: p.brand, country: [...byCountry.keys()][0] })
    else stillUnknown.push(p)
  }

  console.log('\n══════ INFERIDO POR MARCA (todas las filas resueltas de la marca coinciden) ══════')
  console.log(`Perfumes inferidos: ${inferred.length} · quedan sin país: ${stillUnknown.length}`)
  printTable('Inferido: perfumes por país', countBy(inferred, (x) => x.country))
  printTable('Inferido: perfumes por marca', countBy(inferred, (x) => `${x.brand} — ${x.country}`), TOP)
  printTable('Sin país (marca sin evidencia o en conflicto): perfumes por marca', countBy(stillUnknown, (x) => x.brand), TOP)

  if (!APPLY) {
    console.log('\nSimulación terminada: no se escribió nada.')
    return
  }
  await writeCountries(direct.map(({ id, country }) => ({ id, country })))
  await writeCountries(inferred.map(({ id, country }) => ({ id, country })))
  console.log(`\nEscrito: ${direct.length} directos + ${inferred.length} inferidos.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
