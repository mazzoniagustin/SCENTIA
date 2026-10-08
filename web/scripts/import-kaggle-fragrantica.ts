// Importa el dataset "fragrantica-perfumes" de Kaggle (ledecanteur, CC BY-NC-SA 4.0: uso no comercial, con crédito;
// ver /creditos). Aporta lo que el CSV original no tenía: intensidad real de acordes, notas con peso, estaciones y
// momento del día por votos, duración y estela, y votos de la comunidad.
//
//   npx tsx scripts/import-kaggle-fragrantica.ts                 simulación (no escribe nada)
//   npx tsx scripts/import-kaggle-fragrantica.ts --apply [--min-people 50] [--limit N]
//
// 1) Enlaza los perfumes ya importados con su id de Fragrantica (por la URL de data/fra_cleaned.csv).
// 2) Los enlazados se ENRIQUECEN (acordes, notas, estaciones, duración, estela, estadísticas, nombre y marca con acentos),
//    salvo las filas curadas (con priceTier), que solo completan lo vacío.
// 3) Los no existentes con al menos --min-people votos (50 por defecto) y acordes se CREAN.
// Idempotente: se puede repetir. Haga un respaldo antes (scripts/backup-db.ts).
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { parse } from 'csv-parse'
import { parse as parseSync } from 'csv-parse/sync'
import fs from 'fs'
import { ACCORD_TRANSLATIONS } from './accord-translations'
import { humanize, humanizeBrand, parseConcentration } from './humanize'
import { finalSeasons, prepareRow, type Prepared, type RawRow } from '../src/lib/import/kaggle-fragrantica'

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) })

const SOURCE = 'kaggle:ledecanteur/fragrantica-perfumes'
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const APPLY = process.argv.includes('--apply')
const MIN_PEOPLE = parseInt(arg('--min-people') ?? '50', 10)
const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity
const BATCH = 400

const key = (brand: string, name: string) => `${brand}\u0000${name}`
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const clean = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t && t.toLowerCase() !== 'unknown' ? t : ''
}
const lowerTranslations = Object.fromEntries(Object.entries(ACCORD_TRANSLATIONS).map(([k, v]) => [k.toLowerCase(), v]))

type Existing = { id: string; brand: string; name: string; priceTier: string | null; seasons: string[]; occasions: string[] }

/** Paso 1: id de Fragrantica → perfume ya importado (se reconstruye la clave humanizada que usó el import original). */
async function linkExisting(): Promise<Map<string, Existing>> {
  const all = await prisma.perfume.findMany({
    select: { id: true, brand: true, name: true, priceTier: true, seasons: true, occasions: true, sourceId: true },
  })
  const byKey = new Map(all.map((p) => [key(p.brand, p.name), p]))
  const bySource = new Map<string, Existing>()
  for (const p of all) if (p.sourceId) bySource.set(p.sourceId, p)

  const csv = new TextDecoder('windows-1252').decode(fs.readFileSync(path.resolve('data/fra_cleaned.csv')))
  const rows = parseSync(csv, { delimiter: ';', columns: true, skip_empty_lines: true }) as RawRow[]
  const toLink: Array<{ id: string; sourceId: string }> = []
  // Dos filas del CSV original pueden haber terminado en el mismo perfume (nombres iguales tras humanizar): solo la primera se enlaza.
  const claimed = new Set(all.filter((p) => p.sourceId).map((p) => p.id))
  for (const row of rows) {
    const m = /-(\d+)\.html/.exec(row.url ?? '')
    const brandSlug = clean(row.Brand)
    const nameSlug = clean(row.Perfume)
    if (!m || !brandSlug || !nameSlug) continue
    const perfume = byKey.get(key(humanizeBrand(brandSlug), humanize(nameSlug)))
    if (!perfume || bySource.has(m[1]) || claimed.has(perfume.id)) continue
    claimed.add(perfume.id)
    toLink.push({ id: perfume.id, sourceId: m[1] })
    bySource.set(m[1], perfume)
  }
  console.log(`Enlace con el CSV original: ${toLink.length} perfumes por enlazar (${bySource.size} en total con id de Fragrantica).`)
  if (APPLY) {
    for (const part of chunk(toLink, 2000)) {
      await prisma.$executeRaw`
        UPDATE "Perfume" AS pf SET "sourceId" = v.sid
        FROM unnest(${part.map((x) => x.id)}::text[], ${part.map((x) => x.sourceId)}::text[]) AS v(id, sid)
        WHERE pf.id = v.id AND pf."sourceId" IS NULL`
    }
  }
  return bySource
}

async function main() {
  console.log(APPLY ? '*** APLICANDO cambios ***' : '*** SIMULACIÓN: no se escribe nada (agregá --apply) ***')
  console.log(`Mínimo de votos para crear perfumes nuevos: ${MIN_PEOPLE}\n`)
  const bySource = await linkExisting()

  // Claves (marca, nombre) ocupadas, para no chocar con el índice único al renombrar o crear.
  const keyOwner = new Map<string, string>()
  for (const p of await prisma.perfume.findMany({ select: { id: true, brand: true, name: true } })) keyOwner.set(key(p.brand, p.name), p.id)

  const noteIds = new Map((await prisma.note.findMany({ select: { id: true, name: true } })).map((n) => [n.name, n.id]))
  const accordIds = new Map((await prisma.accord.findMany({ select: { id: true, name: true } })).map((a) => [a.name, a.id]))

  const stats = { read: 0, matched: 0, created: 0, skippedFew: 0, skippedNoAccords: 0, invalid: 0, renamed: 0, disambiguated: 0 }
  const sample: string[] = []
  let pending: Array<{ p: Prepared; existing: Existing | null }> = []

  const stream = fs.createReadStream(path.resolve('data/perfumes.csv')).pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true }))
  const seenSource = new Set<string>()
  for await (const row of stream as AsyncIterable<RawRow>) {
    if (stats.read >= LIMIT) break
    stats.read++
    const p = prepareRow(row, lowerTranslations)
    if (!p) { stats.invalid++; continue }
    if (seenSource.has(p.sourceId)) continue
    seenSource.add(p.sourceId)

    const existing = bySource.get(p.sourceId) ?? null
    if (existing) stats.matched++
    else if (p.people < MIN_PEOPLE) { stats.skippedFew++; continue }
    else if (p.accords.length === 0) { stats.skippedNoAccords++; continue }
    else stats.created++

    pending.push({ p, existing })
    if (pending.length >= BATCH) { await flush(); pending = [] }
  }
  await flush()

  async function flush() {
    if (pending.length === 0) return
    // Nombre final: el del dataset (con acentos y mayúsculas); si choca con otro perfume, se desambigua.
    const resolved = pending.map(({ p, existing }) => {
      const curated = existing?.priceTier != null
      const brand = existing && curated ? existing.brand : p.brand
      let name = existing && curated ? existing.name : p.name
      const own = existing?.id ?? null
      const taken = (b: string, n: string) => {
        const owner = keyOwner.get(key(b, n))
        return owner !== undefined && owner !== own
      }
      if (taken(brand, name)) {
        stats.disambiguated++
        name = p.releaseYear && !taken(brand, `${name} (${p.releaseYear})`) ? `${name} (${p.releaseYear})` : `${name} (#${p.sourceId})`
      }
      if (existing && (existing.brand !== brand || existing.name !== name)) stats.renamed++
      // Se reserva ya la clave final: dos filas del mismo lote no pueden quedarse con el mismo nombre.
      if (existing) keyOwner.delete(key(existing.brand, existing.name))
      keyOwner.set(key(brand, name), own ?? `new:${p.sourceId}`)
      return { p, existing, brand, name, curated }
    })

    if (sample.length < 6) for (const r of resolved.slice(0, 2)) sample.push(`${r.existing ? 'ENRIQUECE' : 'CREA     '} ${r.brand} · ${r.name} — ${r.p.accords.length} acordes, ${r.p.notes.length} notas, estaciones ${JSON.stringify(finalSeasons(r.p, r.existing?.seasons))}`)
    if (!APPLY) return

    // Notas y acordes nuevos.
    const newNotes = new Map<string, string>()
    const newAccords = new Set<string>()
    for (const { p } of resolved) {
      for (const n of p.notes) if (!noteIds.has(n.name) && !newNotes.has(n.name)) newNotes.set(n.name, n.type)
      for (const a of p.accords) if (!accordIds.has(a.name)) newAccords.add(a.name)
    }
    if (newNotes.size) {
      await prisma.note.createMany({ data: [...newNotes].map(([name, category]) => ({ name, category })), skipDuplicates: true })
      for (const n of await prisma.note.findMany({ where: { name: { in: [...newNotes.keys()] } } })) noteIds.set(n.name, n.id)
    }
    if (newAccords.size) {
      await prisma.accord.createMany({ data: [...newAccords].map((name) => ({ name })), skipDuplicates: true })
      for (const a of await prisma.accord.findMany({ where: { name: { in: [...newAccords] } } })) accordIds.set(a.name, a.id)
    }

    // Perfumes nuevos.
    const fresh = resolved.filter((r) => !r.existing)
    if (fresh.length) {
      await prisma.perfume.createMany({
        data: fresh.map(({ p, brand, name }) => ({
          brand, name, gender: p.gender,
          concentration: parseConcentration(name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
          releaseYear: p.releaseYear, perfumer: p.perfumer,
          ratingValue: p.ratingValue, ratingCount: p.ratingCount,
          longevity: p.longevity, sillage: p.sillage, projection: p.projection,
          seasons: finalSeasons(p, null), occasions: p.occasions ?? [],
          stats: (p.stats as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          sourceId: p.sourceId, source: SOURCE,
        })),
        skipDuplicates: true,
      })
      const created = await prisma.perfume.findMany({ where: { sourceId: { in: fresh.map((r) => r.p.sourceId) } }, select: { id: true, sourceId: true } })
      const idBySource = new Map(created.map((c) => [c.sourceId!, c.id]))
      for (const r of fresh) r.existing = { id: idBySource.get(r.p.sourceId)!, brand: r.brand, name: r.name, priceTier: null, seasons: [], occasions: [] }
    }

    // Perfumes existentes: un UPDATE con jsonb_to_recordset (los campos del dataset reemplazan lo calculado).
    const toUpdate = resolved.filter((r) => r.existing && !fresh.includes(r))
    if (toUpdate.length) {
      const payload = toUpdate.map(({ p, existing, brand, name, curated }) => ({
        id: existing!.id, brand, name, year: p.releaseYear, perfumer: p.perfumer,
        rating_value: p.ratingValue, rating_count: p.ratingCount,
        longevity: p.longevity, sillage: p.sillage, projection: p.projection,
        // Las filas curadas (con priceTier) conservan sus estaciones y ocasiones.
        seasons: curated && existing!.seasons.length > 0 ? existing!.seasons : finalSeasons(p, existing!.seasons),
        occasions: curated && existing!.occasions.length > 0 ? existing!.occasions : (p.occasions ?? existing!.occasions),
        stats: p.stats,
      }))
      await prisma.$executeRaw`
        UPDATE "Perfume" AS pf SET
          brand = v.brand, name = v.name,
          "releaseYear" = COALESCE(pf."releaseYear", v.year),
          perfumer = COALESCE(v.perfumer, pf.perfumer),
          "ratingValue" = COALESCE(v.rating_value, pf."ratingValue"),
          "ratingCount" = COALESCE(v.rating_count, pf."ratingCount"),
          longevity = v.longevity, sillage = v.sillage,
          projection = COALESCE(pf.projection, v.projection),
          seasons = ARRAY(SELECT jsonb_array_elements_text(v.seasons)),
          occasions = ARRAY(SELECT jsonb_array_elements_text(v.occasions)),
          stats = v.stats,
          source = ${SOURCE}, "updatedAt" = now()
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS v(
          id text, brand text, name text, year int, perfumer text, rating_value float8, rating_count int,
          longevity float8, sillage float8, projection int, seasons jsonb, occasions jsonb, stats jsonb)
        WHERE pf.id = v.id`
    }
    for (const r of resolved) keyOwner.set(key(r.brand, r.name), r.existing!.id)

    // Relaciones: se reemplazan solo cuando el dataset trae datos (si no, se conservan las anteriores).
    // Las filas curadas conservan también sus acordes y notas.
    const withAccords = resolved.filter((r) => !r.curated && r.p.accords.length > 0)
    const withNotes = resolved.filter((r) => !r.curated && r.p.notes.length > 0)
    await prisma.$transaction([
      prisma.perfumeAccord.deleteMany({ where: { perfumeId: { in: withAccords.map((r) => r.existing!.id) } } }),
      prisma.perfumeNote.deleteMany({ where: { perfumeId: { in: withNotes.map((r) => r.existing!.id) } } }),
      prisma.perfumeAccord.createMany({
        data: withAccords.flatMap((r) => r.p.accords.map((a) => ({ perfumeId: r.existing!.id, accordId: accordIds.get(a.name)!, intensity: a.intensity }))),
        skipDuplicates: true,
      }),
      prisma.perfumeNote.createMany({
        data: withNotes.flatMap((r) => r.p.notes.map((n) => ({ perfumeId: r.existing!.id, noteId: noteIds.get(n.name)!, noteType: n.type, weight: n.weight }))),
        skipDuplicates: true,
      }),
    ])
    if (stats.read % 4000 < BATCH) console.log(`  … ${stats.read} filas leídas`)
  }

  console.log('\nMuestra:'); sample.forEach((s) => console.log('  ' + s))
  console.log('\nResumen:', stats)
  if (!APPLY) console.log('\n(Simulación: no se cambió nada. Agregá --apply para escribir; antes, un respaldo.)')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
