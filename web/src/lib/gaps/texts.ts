// Textos de plantilla (español rioplatense) del análisis de huecos. Puro y determinista: el mismo informe da siempre
// el mismo texto. Es el texto por defecto y el respaldo si más adelante se redacta con IA. Neutral: "no explorado" y la
// estela nunca se presentan como carencia ni como logro.
//
// Día/noche: la base solo distingue día y noche (votos de la comunidad), no otras ocasiones; el texto lo dice.

import { DIMENSION_LABELS, VALUE_LABELS, type Dimension } from './dimensions.ts'
import { FAMILY_LABELS, type FamilyCode } from './families.ts'
import { MIN_USABLE_ITEMS } from './analyze.ts'
import type { Covered } from './rank.ts'

export const DAY_NIGHT_NOTE = 'Día o noche sale de los votos de la comunidad: no distingue otras ocasiones, como trabajo o fiestas.'

const pct = (share: number) => `${Math.round(share * 100)} %`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export type GuideLink = { label: string; href: string }
export type Guide = { title: string; text: string; links: GuideLink[] }

/** Guía general para colecciones sin datos suficientes. No incluye ningún análisis. */
export function guideFor(status: 'empty' | 'too_small', used: number, notUsable: number): Guide {
  const links = [
    { label: 'Explorar el catálogo', href: '/perfumes' },
    { label: 'Hacer el quiz de perfil olfativo', href: '/quiz' },
  ]
  if (status === 'too_small') {
    return {
      title: 'Todavía es pronto para hablar de huecos',
      text: `Tenés ${plural(used, 'perfume', 'perfumes')} entre «Lo tengo» y «Probé una muestra». Con menos de ${MIN_USABLE_ITEMS} casi todo parece un hueco, así que esperamos a que cargues algunos más.`,
      links,
    }
  }
  return {
    title: 'Todavía no hay con qué analizar',
    text:
      notUsable > 0
        ? 'Solo tenés perfumes deseados o descartados, y esos no cuentan como parte de tu colección. Marcá algunos como «Lo tengo» o «Probé una muestra» y volvé.'
        : `Guardá al menos ${MIN_USABLE_ITEMS} perfumes como «Lo tengo» o «Probé una muestra» y volvé.`,
    links,
  }
}

export function familyGapText(family: FamilyCode, used: number, catalogShare: number): string {
  return `Ninguno de tus ${used} perfumes es de la familia «${FAMILY_LABELS[family]}», que está en el ${pct(catalogShare)} del catálogo.`
}

export function familyWeakText(family: FamilyCode, count: number, used: number, catalogShare: number): string {
  return `Poca presencia de «${FAMILY_LABELS[family]}»: ${count} de tus ${used} perfumes (${pct(count / used)}), frente al ${pct(catalogShare)} del catálogo.`
}

export function familyUnexploredText(family: FamilyCode, catalogShare: number): string {
  return `Todavía no exploraste «${FAMILY_LABELS[family]}», una familia poco común (el ${pct(catalogShare)} del catálogo).`
}

const SEASON_PHRASE: Record<string, string> = {
  primavera: 'primavera',
  verano: 'verano',
  otoño: 'otoño',
  invierno: 'invierno',
}

function valueNoun(dimension: Dimension, value: string): string {
  if (dimension === 'season') return `de ${SEASON_PHRASE[value] ?? value}`
  if (dimension === 'dayNight') return value === 'dia' ? 'pensados para el día' : 'pensados para la noche'
  if (dimension === 'duration') return `con ${(VALUE_LABELS.duration[value] ?? value).toLowerCase()}`
  return `con ${(VALUE_LABELS.sillage[value] ?? value).toLowerCase()}`
}

export function dimensionGapText(dimension: Dimension, value: string, used: number): string {
  return `Ninguno de tus ${used} perfumes está entre los ${valueNoun(dimension, value)}.`
}

export function dimensionWeakText(dimension: Dimension, value: string, count: number, used: number, catalogShare: number): string {
  return `Pocos perfumes ${valueNoun(dimension, value)}: ${count} de ${used} (${pct(count / used)}), frente al ${pct(catalogShare)} del catálogo.`
}

export function dimensionUnexploredText(dimension: Dimension, value: string, catalogShare: number): string {
  return `Todavía no exploraste los perfumes ${valueNoun(dimension, value)}, poco comunes en el catálogo (${pct(catalogShare)}).`
}

export function insufficientDataText(dimension: Dimension, missingShare: number): string {
  return `No analizamos «${DIMENSION_LABELS[dimension]}»: falta el dato en el ${pct(missingShare)} de tus perfumes.`
}

export function coveredLabel(covered: Covered): string {
  return covered.kind === 'family' ? FAMILY_LABELS[covered.family] : `${DIMENSION_LABELS[covered.dimension]}: ${VALUE_LABELS[covered.dimension][covered.value] ?? covered.value}`
}

export function headlineText(used: number, gaps: number, weak: number): string {
  if (gaps === 0 && weak === 0) return `No encontramos huecos en tus ${used} perfumes con lo que podemos medir.`
  const parts = [
    gaps > 0 ? plural(gaps, 'hueco', 'huecos') : null,
    weak > 0 ? `${plural(weak, 'área', 'áreas')} con poca presencia` : null,
  ].filter(Boolean)
  return `En tus ${used} perfumes encontramos ${parts.join(' y ')}.`
}
