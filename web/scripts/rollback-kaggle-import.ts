// Deshace scripts/import-kaggle-fragrantica.ts usando el respaldo hecho justo antes (scripts/backup-db.ts, TODAS las tablas).
//   npx tsx scripts/rollback-kaggle-import.ts backups/<carpeta>            simulación
//   npx tsx scripts/rollback-kaggle-import.ts backups/<carpeta> --apply
// 1) Borra los perfumes creados por el import (con sourceId y que no estaban en el respaldo).
// 2) Devuelve a los perfumes del respaldo sus valores anteriores (marca, nombre, año, perfumista, ratings, estaciones,
//    ocasiones, proyección, procedencia) y vacía las columnas nuevas (sourceId, longevity, sillage, stats).
// 3) Reemplaza sus notas y acordes por los del respaldo. Las notas/acordes que solo creó el import se eliminan.
// No toca usuarios, colecciones, perfiles ni la racha.
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import fs from 'fs'
import pg from 'pg'

const APPLY = process.argv.includes('--apply')
const dir = process.argv[2]
const CHUNK = 2000
const read = (table: string) =>
  fs.readFileSync(path.join(dir, `${table}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

async function main() {
  if (!dir || dir.startsWith('--')) throw new Error('Indicá la carpeta del respaldo: npx tsx scripts/rollback-kaggle-import.ts backups/<carpeta>')
  const perfumes = read('Perfume'), notes = read('PerfumeNote'), accords = read('PerfumeAccord'), noteRows = read('Note'), accordRows = read('Accord')
  console.log(`Respaldo: ${perfumes.length} perfumes, ${notes.length} relaciones de notas, ${accords.length} de acordes.`)
  console.log(APPLY ? '*** APLICANDO ***' : '*** SIMULACIÓN ***')

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const backupIds = new Set(perfumes.map((p) => p.id as string))
    const { rows: current } = await client.query<{ id: string }>(`SELECT id FROM "Perfume" WHERE "sourceId" IS NOT NULL`)
    const created = current.filter((r) => !backupIds.has(r.id)).map((r) => r.id)
    console.log(`Perfumes creados por el import (se borrarían): ${created.length}`)
    console.log(`Perfumes del respaldo a restaurar: ${perfumes.length}`)
    if (!APPLY) return

    await client.query('BEGIN')
    for (const part of chunk(created, CHUNK)) await client.query(`DELETE FROM "Perfume" WHERE id = ANY($1::text[])`, [part])

    // Restauración de campos en dos fases: primero nombres temporales (por el índice único marca+nombre).
    const ids = perfumes.map((p) => p.id as string)
    for (const part of chunk(ids, CHUNK)) await client.query(`UPDATE "Perfume" SET name = 'tmp-' || id WHERE id = ANY($1::text[])`, [part])
    for (const part of chunk(perfumes, CHUNK)) {
      const payload = part.map((p) => ({
        id: p.id, brand: p.brand, name: p.name, year: p.releaseYear, perfumer: p.perfumer, rv: p.ratingValue, rc: p.ratingCount,
        seasons: p.seasons ?? null, occasions: p.occasions ?? null, projection: p.projection, source: p.source,
      }))
      await client.query(
        `UPDATE "Perfume" AS pf SET brand = v.brand, name = v.name, "releaseYear" = v.year, perfumer = v.perfumer,
           "ratingValue" = v.rv, "ratingCount" = v.rc, projection = v.projection, source = v.source,
           seasons = CASE WHEN v.seasons IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(v.seasons)) END,
           occasions = CASE WHEN v.occasions IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(v.occasions)) END,
           "sourceId" = NULL, longevity = NULL, sillage = NULL, stats = NULL
         FROM jsonb_to_recordset($1::jsonb) AS v(id text, brand text, name text, year int, perfumer text, rv float8, rc int,
           seasons jsonb, occasions jsonb, projection int, source text)
         WHERE pf.id = v.id`,
        [JSON.stringify(payload)],
      )
    }

    // Relaciones: las de los perfumes del respaldo se reemplazan por las originales.
    for (const part of chunk(ids, CHUNK)) {
      await client.query(`DELETE FROM "PerfumeNote" WHERE "perfumeId" = ANY($1::text[])`, [part])
      await client.query(`DELETE FROM "PerfumeAccord" WHERE "perfumeId" = ANY($1::text[])`, [part])
    }
    for (const part of chunk(notes, CHUNK)) {
      await client.query(
        `INSERT INTO "PerfumeNote" ("perfumeId","noteId","noteType") SELECT * FROM unnest($1::text[],$2::text[],$3::text[]) ON CONFLICT DO NOTHING`,
        [part.map((r) => r.perfumeId), part.map((r) => r.noteId), part.map((r) => r.noteType)],
      )
    }
    for (const part of chunk(accords, CHUNK)) {
      await client.query(
        `INSERT INTO "PerfumeAccord" ("perfumeId","accordId","intensity") SELECT * FROM unnest($1::text[],$2::text[],$3::int[]) ON CONFLICT DO NOTHING`,
        [part.map((r) => r.perfumeId), part.map((r) => r.accordId), part.map((r) => r.intensity)],
      )
    }
    // Notas y acordes que solo existían por el import.
    await client.query(`DELETE FROM "Note" WHERE NOT (id = ANY($1::text[]))`, [noteRows.map((n) => n.id)])
    await client.query(`DELETE FROM "Accord" WHERE NOT (id = ANY($1::text[]))`, [accordRows.map((a) => a.id)])
    await client.query('COMMIT')
    console.log('Rollback aplicado.')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
