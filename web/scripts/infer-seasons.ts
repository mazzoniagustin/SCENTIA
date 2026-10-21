// Infiere `Perfume.seasons` a partir de los acordes (reglas de src/lib/seasons.ts).
//   npx tsx scripts/infer-seasons.ts            simulación: muestra la distribución, no escribe
//   npx tsx scripts/infer-seasons.ts --apply    escribe; solo completa perfumes con seasons vacío
// Nunca pisa estaciones ya cargadas (ej. las del seed curado) ni toca otros campos.
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import pg from 'pg'
import { inferSeasons, SEASONS, type SeasonAccord } from '../src/lib/seasons'

const apply = process.argv.includes('--apply')

async function run() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ id: string; label: string; seasons: string[] | null; name: string; intensity: number }>(
      `SELECT p.id, p.brand || ' — ' || p.name AS label, p.seasons, a.name, pa.intensity::int AS intensity
       FROM "Perfume" p
       LEFT JOIN "PerfumeAccord" pa ON pa."perfumeId" = p.id
       LEFT JOIN "Accord" a ON a.id = pa."accordId"
       WHERE p."ownerId" IS NULL`,
    )

    const perfumes = new Map<string, { label: string; seasons: string[]; accords: SeasonAccord[] }>()
    for (const r of rows) {
      const p = perfumes.get(r.id) ?? { label: r.label, seasons: r.seasons ?? [], accords: [] }
      if (r.name) p.accords.push({ name: r.name, intensity: r.intensity })
      perfumes.set(r.id, p)
    }

    // Agrupa por combinación de estaciones: un UPDATE por combinación, no uno por perfume.
    const groups = new Map<string, string[]>()
    let alreadySet = 0
    const examples = new Map<string, string[]>()
    for (const [id, p] of perfumes) {
      if (p.seasons.length > 0) { alreadySet++; continue }
      const inferred = inferSeasons(p.accords)
      const key = inferred.join(',')
      groups.set(key, [...(groups.get(key) ?? []), id])
      const ex = examples.get(key) ?? []
      if (ex.length < 3) examples.set(key, [...ex, p.label])
    }

    console.log(`perfumes: ${perfumes.size} | ya con estaciones (no se tocan): ${alreadySet}`)
    console.log('distribución inferida:')
    for (const [key, ids] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${(key || '(sin señal → vacío)').padEnd(28)} ${String(ids.length).padStart(6)}   ej: ${examples.get(key)!.join(' | ')}`)
    }
    const perSeason = Object.fromEntries(SEASONS.map((s) => [s, [...groups].filter(([k]) => k.split(',').includes(s)).reduce((n, [, ids]) => n + ids.length, 0)]))
    console.log('perfumes por estación:', perSeason)

    if (!apply) { console.log('\nSimulación: no se escribió nada. Usar --apply para guardar.'); return }

    await client.query('BEGIN')
    let updated = 0
    for (const [key, ids] of groups) {
      if (!key) continue
      const res = await client.query(
        `UPDATE "Perfume" SET seasons = $1::text[], "updatedAt" = now() WHERE id = ANY($2::text[]) AND (seasons IS NULL OR cardinality(seasons) = 0)`,
        [key.split(','), ids],
      )
      updated += res.rowCount ?? 0
    }
    await client.query('COMMIT')
    console.log(`\nActualizados: ${updated}`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

run().catch((e) => { console.error(e); process.exitCode = 1 })
