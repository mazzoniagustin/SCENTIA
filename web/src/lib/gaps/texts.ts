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

// Los textos que ve la persona hablan de SU colección: qué parte todavía no exploró. No se compara con el catálogo
// (el catálogo solo sirve por dentro para decidir qué cuenta como hueco).
export function familyGapText(family: FamilyCode, used: number): string {
  return `Ninguno de tus ${used} perfumes es de la familia «${FAMILY_LABELS[family]}».`
}

export function familyWeakText(family: FamilyCode, count: number, used: number): string {
  return `Poca presencia de «${FAMILY_LABELS[family]}»: ${count} de tus ${used} perfumes (${pct(count / used)}).`
}

export function familyUnexploredText(family: FamilyCode): string {
  return `Todavía no exploraste «${FAMILY_LABELS[family]}», un rincón para curiosear.`
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

export function dimensionWeakText(dimension: Dimension, value: string, count: number, used: number): string {
  return `Pocos perfumes ${valueNoun(dimension, value)}: ${count} de ${used} (${pct(count / used)}).`
}

export function dimensionUnexploredText(dimension: Dimension, value: string): string {
  return `Todavía no exploraste los perfumes ${valueNoun(dimension, value)}.`
}

export function insufficientDataText(dimension: Dimension, missingShare: number): string {
  return `No analizamos «${DIMENSION_LABELS[dimension]}»: falta el dato en el ${pct(missingShare)} de tus perfumes.`
}

/** Lo que cubre un candidato, en una etiqueta corta: la familia, o el valor ("Otoño", "Para la noche", "Duración larga"). */
export function coveredLabel(covered: Covered): string {
  if (covered.kind === 'family') return FAMILY_LABELS[covered.family]
  const label = VALUE_LABELS[covered.dimension][covered.value] ?? covered.value
  if (covered.dimension === 'season') return `Estación: ${label}`
  if (covered.dimension === 'dayNight') return covered.value === 'dia' ? 'Para el día' : 'Para la noche'
  return label
}

/** Etiqueta de un hallazgo para el titular, entre comillas angulares para que "Empolvado y almizclado" no se confunda con una lista. */
export function headlineLabel(area: 'family' | Dimension, code: string): string {
  if (area === 'family') return `«${FAMILY_LABELS[code as FamilyCode] ?? code}»`
  if (area === 'season') return `«perfumes de ${SEASON_PHRASE[code] ?? code}»`
  if (area === 'dayNight') return code === 'dia' ? '«perfumes para el día»' : '«perfumes para la noche»'
  return `«${(VALUE_LABELS[area][code] ?? code).toLowerCase()}»`
}

const MAX_HEADLINE_LABELS = 4

/** "A", "A y B", "A, B y C"; con más de 4, "A, B, C, D y 2 más". */
function listEs(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length <= MAX_HEADLINE_LABELS) return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
  return `${items.slice(0, MAX_HEADLINE_LABELS).join(', ')} y ${items.length - MAX_HEADLINE_LABELS} más`
}

/** Titular del análisis: lo que menos exploró la persona (huecos y poca presencia), sin comparar con el catálogo. */
export function headlineText(used: number, labels: readonly string[]): string {
  if (labels.length === 0) return `No encontramos huecos en tus ${used} perfumes con lo que podemos medir.`
  return `Lo que menos exploraste: ${listEs(labels)}.`
}
