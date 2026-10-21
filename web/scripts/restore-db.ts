// Restaura filas desde un respaldo de scripts/backup-db.ts. NO destructivo: inserta con ON CONFLICT DO NOTHING,
// así que nunca pisa ni borra datos existentes (sirve para recuperar filas perdidas o repoblar una base vacía).
//   npx tsx scripts/restore-db.ts backups/<carpeta> [--tables User,UserProfile]
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import fs from 'fs'
import pg from 'pg'

import { RESTORE_ORDER as ORDER } from './backup-plan'
const CHUNK = 2000

async function main() {
  const dir = process.argv[2]
  if (!dir || dir.startsWith('--')) throw new Error('Indicá la carpeta del respaldo: npx tsx scripts/restore-db.ts backups/<carpeta>')
  const only = process.argv.includes('--tables') ? process.argv[process.argv.indexOf('--tables') + 1].split(',') : null

  const available = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => f.replace(/\.jsonl$/, ''))
  const tables = ORDER.filter((t) => available.includes(t) && (!only || only.includes(t)))
  if (tables.length === 0) throw new Error('No hay tablas para restaurar en esa carpeta')

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    for (const table of tables) {
      const quoted = `"${table}"`
      const lines = fs.readFileSync(path.join(dir, `${table}.jsonl`), 'utf8').split('\n').filter(Boolean)
      let inserted = 0
      for (let i = 0; i < lines.length; i += CHUNK) {
        const json = `[${lines.slice(i, i + CHUNK).join(',')}]`
        const res = await client.query(
          `INSERT INTO ${quoted} SELECT * FROM jsonb_populate_recordset(NULL::${quoted}, $1::jsonb) ON CONFLICT DO NOTHING`,
          [json],
        )
        inserted += res.rowCount ?? 0
      }
      console.log(`${table.padEnd(16)} ${String(lines.length).padStart(7)} en el respaldo | ${String(inserted).padStart(7)} insertadas | ${lines.length - inserted} ya existían`)
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e.message); process.exitCode = 1 })
