// Análisis determinista de huecos por familia olfativa. Puro: sin base, sin red, sin LLM. La misma entrada
// da siempre el mismo informe (ADR-009: la decisión nunca depende de un modelo).
//
// Qué cuenta: solo OWNED y SAMPLED. WISHLIST y DISLIKED no cubren nada (los descartados no penalizan acordes).
// Un perfume "tiene" una familia si alguno de sus acordes de esa familia llega a ACCORD_PRESENCE_MIN_INTENSITY.

import { FAMILY_ORDER, familyOfAccord, type FamilyCode } from './families.ts'
import type { CatalogShares, CollectionSample, FamilyCoverage, FamilyReport } from './types.ts'

/** Mismo umbral de presencia que el quiz y los filtros por acorde del catálogo. */
export const ACCORD_PRESENCE_MIN_INTENSITY = 40
/** Menos perfumes usables que esto: se describe la colección pero no se habla de huecos. */
export const MIN_USABLE_ITEMS = 3
/** Familias que están en menos de esta parte del catálogo se muestran como "no explorado", nunca como hueco. */
export const UNEXPLORED_CATALOG_SHARE = 0.2
/** La cobertura débil solo se evalúa con al menos esta cantidad de perfumes usables. */
export const WEAK_COVERAGE_MIN_ITEMS = 6
/** Cobertura débil: presencia en la colección menor a esta fracción de la frecuencia en el catálogo. */
export const WEAK_COVERAGE_RATIO = 0.5

const USABLE = new Set(['OWNED', 'SAMPLED'])

/** Familias que tiene un perfume, según sus acordes. Ignora acordes sin familia y los de poca intensidad. */
export function familiesOfAccords(accords: readonly { name: string; intensity: number }[]): Set<FamilyCode> {
  const found = new Set<FamilyCode>()
  for (const { name, intensity } of accords) {
    if (intensity < ACCORD_PRESENCE_MIN_INTENSITY) continue
    const family = familyOfAccord(name)
    if (family) found.add(family)
  }
  return found
}

/**
 * Parte del catálogo que tiene cada familia, a partir de los acordes de cada perfume. Función pura para probar
 * el criterio; la capa de datos calcula lo mismo con SQL y debe coincidir.
 */
export function catalogFamilyShares(catalog: readonly (readonly { name: string; intensity: number }[])[]): CatalogShares {
  const counts = Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0])) as Record<FamilyCode, number>
  for (const accords of catalog) for (const family of familiesOfAccords(accords)) counts[family] += 1
  const total = catalog.length
  return Object.fromEntries(FAMILY_ORDER.map((f) => [f, total === 0 ? 0 : counts[f] / total])) as Record<FamilyCode, number>
}

function classify(count: number, used: number, catalogShare: number): FamilyCoverage['level'] {
  if (catalogShare < UNEXPLORED_CATALOG_SHARE) return count === 0 ? 'unexplored' : 'covered'
  if (count === 0) return 'gap'
  if (used >= WEAK_COVERAGE_MIN_ITEMS && count / used < WEAK_COVERAGE_RATIO * catalogShare) return 'weak'
  return 'covered'
}

export function analyzeFamilies(samples: readonly CollectionSample[], shares: CatalogShares): FamilyReport {
  const usable = samples.filter((s) => USABLE.has(s.status))
  const withAccords = usable.filter((s) => s.accords.length > 0)
  const coverage = {
    used: withAccords.length,
    skippedWithoutAccords: usable.length - withAccords.length,
    notUsable: samples.length - usable.length,
  }

  if (coverage.used === 0) return { status: 'empty', coverage, families: [], gaps: [], weak: [], unexplored: [] }

  const counts = Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0])) as Record<FamilyCode, number>
  for (const sample of withAccords) for (const family of familiesOfAccords(sample.accords)) counts[family] += 1

  const families: FamilyCoverage[] = FAMILY_ORDER.map((family) => {
    const catalogShare = shares[family] ?? 0
    return {
      family,
      count: counts[family],
      presence: counts[family] / coverage.used,
      catalogShare,
      level: classify(counts[family], coverage.used, catalogShare),
    }
  })

  if (coverage.used < MIN_USABLE_ITEMS) return { status: 'too_small', coverage, families, gaps: [], weak: [], unexplored: [] }

  const order = (a: FamilyCoverage, b: FamilyCoverage) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family)
  const relative = (c: FamilyCoverage) => c.presence / c.catalogShare
  return {
    status: 'ok',
    coverage,
    families,
    gaps: families.filter((c) => c.level === 'gap').sort((a, b) => b.catalogShare - a.catalogShare || order(a, b)),
    weak: families.filter((c) => c.level === 'weak').sort((a, b) => relative(a) - relative(b) || order(a, b)),
    unexplored: families.filter((c) => c.level === 'unexplored').sort(order),
  }
}
