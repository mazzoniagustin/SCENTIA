// Vista previa SOLO LECTURA de "¿Qué le falta a mi colección?" para una persona. Corre el flujo completo (colección →
// frecuencias del catálogo → huecos → candidatos → ranking) y lo imprime. No escribe nada en la base. No imprime
// correos, notas, puntajes ni los nombres de tus perfumes: solo conteos y los candidatos sugeridos.
//
//   npx tsx --conditions=react-server scripts/gaps-preview.ts --list
//   npx tsx --conditions=react-server scripts/gaps-preview.ts --nickname <apodo>
//   npx tsx --conditions=react-server scripts/gaps-preview.ts --user-id <id>
// Con --gender masculino|unisex|femenino|todos fuerza el género de las sugerencias (por defecto se deduce de la colección).
// Con --json imprime exactamente la respuesta pública que devolvería POST /api/collection/gaps.
// Con --twice repite el cálculo para ver los tiempos en frío y con las cachés en memoria ya calientes.
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { prisma } from '../src/lib/prisma'
import { buildGapAnalysis, queryCatalogCounts, sharesFromCounts } from '../src/lib/gaps/data'
import { FAMILY_LABELS } from '../src/lib/gaps/families'
import { DIMENSION_LABELS, VALUE_LABELS } from '../src/lib/gaps/dimensions'
import { WISHLIST_LABEL, type Covered } from '../src/lib/gaps/rank'
import { buildGapsResponse } from '../src/lib/gaps/response'
import { GENDER_FILTERS, type GenderFilter } from '../src/lib/gaps/gender'
import type { FamilyCoverage } from '../src/lib/gaps/types'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : (args[i + 1] ?? '')
}
const pct = (n: number) => `${(n * 100).toFixed(0)} %`

function describeCovered(c: Covered): string {
  return c.kind === 'family' ? FAMILY_LABELS[c.family] : `${DIMENSION_LABELS[c.dimension]}: ${VALUE_LABELS[c.dimension][c.value] ?? c.value}`
}

async function listUsers() {
  // Apodo (público) y conteos por estado. Nunca el correo.
  const rows = await prisma.$queryRaw<Array<{ id: string; nickname: string | null; owned: number; sampled: number; wishlist: number; disliked: number }>>`
    SELECT u.id, up.nickname,
      COUNT(*) FILTER (WHERE uc.status = 'OWNED')::int AS owned,
      COUNT(*) FILTER (WHERE uc.status = 'SAMPLED')::int AS sampled,
      COUNT(*) FILTER (WHERE uc.status = 'WISHLIST')::int AS wishlist,
      COUNT(*) FILTER (WHERE uc.status = 'DISLIKED')::int AS disliked
    FROM "User" u
    LEFT JOIN "UserProfile" up ON up."userId" = u.id
    JOIN "UserCollection" uc ON uc."userId" = u.id
    GROUP BY u.id, up.nickname
    ORDER BY COUNT(*) DESC, u.id
    LIMIT 30`
  console.log('Personas con colección (apodo | id | Lo tengo / Probado / Deseado / Descartado):')
  for (const r of rows) console.log(`  ${(r.nickname ?? '(sin apodo)').padEnd(22)} ${r.id}  ${r.owned} / ${r.sampled} / ${r.wishlist} / ${r.disliked}`)
}

async function resolveUserId(): Promise<string | null> {
  const id = flag('--user-id')
  if (id) return (await prisma.user.findUnique({ where: { id }, select: { id: true } }))?.id ?? null
  const nickname = flag('--nickname')
  if (nickname) {
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>`SELECT "userId" FROM "UserProfile" WHERE lower(nickname) = lower(${nickname}) LIMIT 1`
    return rows[0]?.userId ?? null
  }
  return null
}

function printCoverage(title: string, items: FamilyCoverage[], label: (c: FamilyCoverage) => string) {
  console.log(`  ${title}: ${items.length === 0 ? '—' : ''}`)
  for (const c of items) console.log(`    · ${label(c)}: ${c.count} perfumes (${pct(c.presence)} de tu colección; ${pct(c.catalogShare)} del catálogo)`)
}

async function main() {
  if (args.includes('--list')) return listUsers()
  const userId = await resolveUserId()
  if (!userId) {
    console.error('Indicá --list, --nickname <apodo> o --user-id <id> (y que exista).')
    process.exitCode = 1
    return
  }

  const t0 = Date.now()
  const counts = await queryCatalogCounts()
  const t1 = Date.now()
  const requested = flag('--gender')
  if (requested !== undefined && !(GENDER_FILTERS as readonly string[]).includes(requested)) {
    console.error(`--gender debe ser uno de: ${GENDER_FILTERS.join(', ')}`)
    process.exitCode = 1
    return
  }
  const gender = requested as GenderFilter | undefined
  const analysis = await buildGapAnalysis(userId, sharesFromCounts(counts), { gender })
  const t2 = Date.now()

  if (args.includes('--json')) return console.log(JSON.stringify(buildGapsResponse(analysis), null, 2))

  const { families, dimensions } = analysis
  if (args.includes('--twice')) {
    const w0 = Date.now()
    await queryCatalogCounts()
    const w1 = Date.now()
    await buildGapAnalysis(userId, sharesFromCounts(counts), { gender })
    console.log(`Tiempos: frecuencias ${t1 - t0} ms (1.ª) / ${w1 - w0} ms (2.ª); análisis ${t2 - t1} ms (1.ª) / ${Date.now() - w1} ms (2.ª)\n`)
  }
  console.log(`Catálogo: ${counts.families.total} perfumes publicados (frecuencias en ${t1 - t0} ms).`)
  console.log(`Estado: ${families.status}. Usados ${families.coverage.used}, sin acordes ${families.coverage.skippedWithoutAccords}, deseados/descartados ${families.coverage.notUsable}.`)
  if (families.status === 'empty') return console.log('Sin perfumes de "Lo tengo" o "Probado" con acordes: no hay nada que analizar.')
  if (families.status === 'too_small') console.log('Colección chica (menos de 3): se describe pero no se marcan huecos.')

  console.log('\nFamilias olfativas')
  for (const c of families.families) console.log(`  ${FAMILY_LABELS[c.family].padEnd(24)} ${String(c.count).padStart(3)} perfumes  tuyo ${pct(c.presence).padStart(5)}  catálogo ${pct(c.catalogShare).padStart(5)}  ${c.level}`)
  printCoverage('Huecos', families.gaps, (c) => FAMILY_LABELS[c.family])
  printCoverage('Cobertura débil', families.weak, (c) => FAMILY_LABELS[c.family])
  printCoverage('No explorado', families.unexplored, (c) => FAMILY_LABELS[c.family])

  console.log('\nEstación, día/noche, duración y estela')
  for (const d of dimensions.dimensions) {
    console.log(`  ${DIMENSION_LABELS[d.dimension]}: ${d.status === 'insufficient_data' ? `datos insuficientes (falta en ${pct(d.missingShare)})` : `${d.withData} con dato`}`)
    for (const v of d.values) console.log(`    ${(VALUE_LABELS[d.dimension][v.value] ?? v.value).padEnd(18)} ${String(v.count).padStart(3)}  tuyo ${pct(v.presence).padStart(5)}  catálogo ${pct(v.catalogShare).padStart(5)}  ${v.level}`)
  }

  console.log(`\nGénero de las sugerencias: ${analysis.gender.applied}${analysis.gender.chosen ? ' (elegido)' : ` (deducido de la colección: ${analysis.gender.inferred})`}`)
  console.log(`Necesidades buscadas: ${analysis.needs.length === 0 ? 'ninguna' : analysis.needs.map((n) => `${n.kind === 'family' ? FAMILY_LABELS[n.family] : `${DIMENSION_LABELS[n.dimension]} ${VALUE_LABELS[n.dimension][n.value]}`} (${n.weight})`).join(', ')}`)
  console.log(`Candidatos (${analysis.suggestions.length}${analysis.complete ? '' : ', lista corta'}, calculados en ${t2 - t1} ms):`)
  for (const [i, s] of analysis.suggestions.entries()) {
    console.log(`  ${i + 1}. ${s.brand} — ${s.name}  [puntaje ${s.score.toFixed(3)}]`)
    console.log(`     cubre: ${s.covers.map(describeCovered).join('; ')}${s.inWishlist ? `\n     ${WISHLIST_LABEL}` : ''}`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
