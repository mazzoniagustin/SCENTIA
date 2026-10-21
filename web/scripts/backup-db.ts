// Respaldo de la base a archivos JSONL (una fila por línea) en backups/<fecha>/ (carpeta ignorada por git).
//   npx tsx scripts/backup-db.ts                 todas las tablas del esquema public
//   npx tsx scripts/backup-db.ts --user-data     solo lo irreemplazable: User, UserCollection, UserProfile y los perfumes propios
//                                                (Perfume con ownerId y sus PerfumeAccord)
// El catálogo (Perfume, Note, Accord y relaciones) se puede regenerar con scripts/import-fragrantica-batch.ts;
// los datos de las personas y sus perfumes propios no. Los respaldos contienen emails y notas privadas: no los compartas ni los subas.
// Verifica cada archivo contra el conteo de filas de la base. Restaurar: ver docs/despliegue.md.
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import fs from 'fs'
import pg from 'pg'

import { selectionFor } from './backup-plan'

async function main() {
  const onlyUsers = process.argv.includes('--user-data')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const allTables = (
      await client.query<{ relname: string }>(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`,
      )
    ).rows.map((r) => r.relname)
    const tables = selectionFor(allTables, onlyUsers)

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = path.resolve('backups', `${stamp}${onlyUsers ? '-usuarios' : ''}`)
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })

    let failures = 0
    for (const { table, where } of tables) {
      const quoted = `"${table.replace(/"/g, '""')}"`
      const rows = (await client.query<{ row: unknown }>(`SELECT row_to_json(t) AS row FROM ${quoted} t ${where}`)).rows
      const file = path.join(dir, `${table}.jsonl`)
      fs.writeFileSync(file, rows.map((r) => JSON.stringify(r.row)).join('\n') + (rows.length ? '\n' : ''), { mode: 0o600 })

      const expected = Number((await client.query(`SELECT COUNT(*)::int AS n FROM ${quoted} t ${where}`)).rows[0].n)
      const written = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length
      const ok = written === expected
      if (!ok) failures++
      console.log(`${ok ? 'OK   ' : 'FALLA'} ${table.padEnd(16)} ${String(written).padStart(7)} filas  ${(fs.statSync(file).size / 1024).toFixed(0).padStart(7)} KB`)
    }
    console.log(`\nRespaldo en ${path.relative(process.cwd(), dir)} (${tables.length} tablas)`)
    if (failures > 0) throw new Error(`${failures} tabla(s) no coinciden con la base`)
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
