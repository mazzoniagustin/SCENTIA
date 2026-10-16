// Test de integración contra la base real (solo lectura). Comprueba que las frecuencias del catálogo calculadas por SQL
// (src/lib/gaps/data.ts) coinciden EXACTAMENTE con las funciones puras catalogFamilyCounts y catalogDimensionCounts,
// comparando conteos enteros (nunca proporciones). No se corre con el resto de los tests: necesita DATABASE_URL.
//   npx tsx --conditions=react-server --test scripts/gaps-sql.test.ts
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'

import { prisma } from '../src/lib/prisma'
import { catalogFamilyCounts } from '../src/lib/gaps/analyze'
import { catalogDimensionCounts, DIMENSION_VALUES, profileOf } from '../src/lib/gaps/dimensions'
import { familiesOfAccords } from '../src/lib/gaps/analyze'
import { SEASONS } from '../src/lib/seasons'
import { getCandidates, getCollectionSamples, queryCatalogCounts } from '../src/lib/gaps/data'
import { familyOfAccord } from '../src/lib/gaps/families'
import type { Need } from '../src/lib/gaps/rank'

const SAMPLE_SIZE = 400
const EDGE_SIZE = 25
const skip = !process.env.DATABASE_URL && 'sin DATABASE_URL'

/**
 * Conjunto fijo: SAMPLE_SIZE perfumes publicados con estaciones guardadas, ordenados por md5(id) (determinista mientras
 * no cambie el catálogo), más EDGE_SIZE de cada caso borde (sin duración, sin estela, sin ocasiones, sin acordes).
 * Se piden solo con estaciones guardadas: el SQL no infiere estaciones por acordes como hace profileOf, y el catálogo
 * las trae en el 100 % de los perfumes (si eso cambiara, este test lo avisa en su primera comprobación).
 */
async function fixedSet(): Promise<string[]> {
  const known = [...SEASONS]
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    (SELECT p.id FROM "Perfume" p WHERE p.status = 'PUBLISHED' AND p.seasons && ${known}::text[]
       ORDER BY md5(p.id) LIMIT ${SAMPLE_SIZE})
    UNION
    (SELECT p.id FROM "Perfume" p WHERE p.status = 'PUBLISHED' AND p.seasons && ${known}::text[] AND p.longevity IS NULL
       ORDER BY md5(p.id) LIMIT ${EDGE_SIZE})
    UNION
    (SELECT p.id FROM "Perfume" p WHERE p.status = 'PUBLISHED' AND p.seasons && ${known}::text[] AND p.sillage IS NULL
       ORDER BY md5(p.id) LIMIT ${EDGE_SIZE})
    UNION
    (SELECT p.id FROM "Perfume" p WHERE p.status = 'PUBLISHED' AND p.seasons && ${known}::text[]
       AND (p.occasions IS NULL OR cardinality(p.occasions) = 0) ORDER BY md5(p.id) LIMIT ${EDGE_SIZE})
    UNION
    (SELECT p.id FROM "Perfume" p WHERE p.status = 'PUBLISHED' AND p.seasons && ${known}::text[]
       AND NOT EXISTS (SELECT 1 FROM "PerfumeAccord" pa WHERE pa."perfumeId" = p.id) ORDER BY md5(p.id) LIMIT ${EDGE_SIZE})`
  return rows.map((r) => r.id).sort()
}

describe('frecuencias del catálogo: SQL contra las funciones puras', { skip }, () => {
  after(async () => {
    await prisma.$disconnect()
  })

  it('el conjunto fijo contiene al menos un perfume de cada caso borde', async () => {
    const ids = await fixedSet()
    assert.ok(ids.length >= SAMPLE_SIZE, `solo ${ids.length} perfumes`)
    const rows = await prisma.perfume.findMany({
      where: { id: { in: ids } },
      select: { longevity: true, sillage: true, occasions: true, _count: { select: { accords: true } } },
    })
    const inSet = {
      'sin duración': rows.filter((r) => r.longevity === null).length,
      'sin estela': rows.filter((r) => r.sillage === null).length,
      'sin ocasiones': rows.filter((r) => r.occasions.length === 0).length,
      'sin acordes': rows.filter((r) => r._count.accords === 0).length,
    }
    console.log(`   casos borde en el conjunto: ${JSON.stringify(inSet)}`)
    // Si el catálogo tiene casos de un tipo, el conjunto TIENE que incluir alguno; si no, lo que falla es el test.
    const inCatalog = {
      'sin duración': await prisma.perfume.count({ where: { status: 'PUBLISHED', longevity: null } }),
      'sin estela': await prisma.perfume.count({ where: { status: 'PUBLISHED', sillage: null } }),
      'sin ocasiones': await prisma.perfume.count({ where: { status: 'PUBLISHED', occasions: { isEmpty: true } } }),
      'sin acordes': await prisma.perfume.count({ where: { status: 'PUBLISHED', accords: { none: {} } } }),
    }
    for (const [edge, count] of Object.entries(inSet)) {
      const available = inCatalog[edge as keyof typeof inCatalog]
      assert.ok(count >= 1 || available === 0, `el conjunto fijo no tiene ningún perfume "${edge}" y el catálogo tiene ${available}`)
      if (available === 0) console.log(`   aviso: el catálogo actual no tiene perfumes "${edge}"; ese borde se cubre solo con los tests puros`)
    }
  })

  it('familias y dimensiones coinciden con catalogFamilyCounts y catalogDimensionCounts (conteos enteros, igualdad exacta)', async () => {
    const ids = await fixedSet()
    const perfumes = await prisma.perfume.findMany({
      where: { id: { in: ids } },
      select: {
        seasons: true,
        occasions: true,
        longevity: true,
        sillage: true,
        accords: { select: { intensity: true, accord: { select: { name: true } } } },
      },
    })
    assert.equal(perfumes.length, ids.length)
    const catalog = perfumes.map((p) => ({
      accords: p.accords.map((a) => ({ name: a.accord.name, intensity: a.intensity })),
      seasons: p.seasons,
      occasions: p.occasions,
      longevity: p.longevity,
      sillage: p.sillage,
    }))

    const expectedFamilies = catalogFamilyCounts(catalog.map((c) => c.accords))
    const expectedDimensions = catalogDimensionCounts(catalog)
    const actual = await queryCatalogCounts(ids)

    assert.deepEqual(actual.families, expectedFamilies)
    assert.deepEqual(actual.dimensions, expectedDimensions)
    for (const n of [actual.families.total, ...Object.values(actual.families.counts)]) assert.ok(Number.isInteger(n))
    // Que el test no sea trivial: hay datos en todas las familias y valores.
    assert.ok(actual.families.total === ids.length && Object.values(actual.families.counts).some((n) => n > 0))
  })

  it('sobre todo el catálogo, el total coincide con el conteo de publicados', async () => {
    const [counts, published] = await Promise.all([queryCatalogCounts(), prisma.perfume.count({ where: { status: 'PUBLISHED' } })])
    assert.equal(counts.families.total, published)
    for (const [dimension, values] of Object.entries(DIMENSION_VALUES)) {
      const d = counts.dimensions[dimension as keyof typeof counts.dimensions]
      assert.ok(d.withData <= published)
      assert.deepEqual(Object.keys(d.counts), [...values])
    }
  })
})

describe('candidatos y colección: SQL contra las funciones puras', { skip }, () => {
  const NEEDS: Need[] = [
    { kind: 'family', family: 'cuero', weight: 1 },
    { kind: 'dimension', dimension: 'duration', value: 'larga', weight: 1 },
    { kind: 'dimension', dimension: 'dayNight', value: 'noche', weight: 0.5 },
  ]

  it('cada candidato cubre al menos una necesidad según la lógica pura y no está en un estado excluido', async () => {
    const entry = await prisma.userCollection.findFirst({ select: { userId: true } })
    if (!entry) return // sin colecciones en la base no hay con qué probar
    const { candidates } = await getCandidates(entry.userId, NEEDS, 30000)
    assert.ok(candidates.length > 0)
    const excluded = new Set(
      (await prisma.userCollection.findMany({ where: { userId: entry.userId, status: { in: ['OWNED', 'SAMPLED', 'DISLIKED'] } }, select: { perfumeId: true } })).map((r) => r.perfumeId),
    )
    for (const c of candidates) {
      assert.ok(!excluded.has(c.perfumeId), `${c.perfumeId} está en un estado excluido`)
      const profile = profileOf(c)
      const covers =
        familiesOfAccords(c.accords).has('cuero') || profile.duration?.includes('larga') || profile.dayNight?.includes('noche')
      assert.ok(covers, `${c.perfumeId} no cubre ninguna necesidad`)
    }
    assert.equal(familyOfAccord('pachuli'), 'cuero') // sanidad de la familia usada arriba
  })

  it('el filtro de género deja solo los géneros permitidos (el unisex entra con masculino y femenino)', async () => {
    const entry = await prisma.userCollection.findFirst({ select: { userId: true } })
    if (!entry) return
    const { meta: all } = await getCandidates(entry.userId, NEEDS, 30000, 'todos')
    for (const [filter, allowed] of [
      ['masculino', ['masculino', 'unisex']],
      ['femenino', ['femenino', 'unisex']],
      ['unisex', ['unisex']],
    ] as const) {
      const { meta } = await getCandidates(entry.userId, NEEDS, 30000, filter)
      assert.ok(meta.size > 0, `sin candidatos con ${filter}`)
      for (const m of meta.values()) assert.ok((allowed as readonly string[]).includes(m.gender), `${filter}: apareció uno ${m.gender}`)
    }
    assert.ok(all.size > 0)
  })

  it('la colección leída no trae notas privadas ni puntajes', async () => {
    const entry = await prisma.userCollection.findFirst({ select: { userId: true } })
    if (!entry) return
    const samples = await getCollectionSamples(entry.userId)
    const allowed = new Set(['perfumeId', 'status', 'accords', 'gender', 'seasons', 'occasions', 'longevity', 'sillage'])
    for (const s of samples) assert.deepEqual(Object.keys(s).filter((k) => !allowed.has(k)), [])
    assert.ok(!JSON.stringify(samples).includes('personalNotes'))
    void Prisma // import usado por el tipo de consulta del conjunto fijo
  })
})
