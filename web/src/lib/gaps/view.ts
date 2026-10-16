// Lógica pura de la interfaz de "¿Qué le falta a mi colección?": estados, Retry-After y agrupado de hallazgos.
// Sin React, para poder probarla con node:test.

import { accordDotColor, NEUTRAL_DOT_COLOR } from '../cover.ts'
import type { Finding, GapsResponse, RefineResponse, SuggestionOut } from './response.ts'

export type GapsView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: GapsResponse }
  | { kind: 'guide'; data: GapsResponse }
  | { kind: 'unauthorized' }
  | { kind: 'rate_limited'; seconds: number }
  | { kind: 'error' }
  | { kind: 'network' }

/** Segundos de espera del encabezado Retry-After (solo enteros positivos; tope de una hora). 0 si no sirve. */
export function parseRetryAfter(header: string | null | undefined): number {
  if (!header || !/^\s*\d+\s*$/.test(header)) return 0
  const seconds = Number.parseInt(header, 10)
  return seconds > 0 ? Math.min(seconds, 3600) : 0
}

/** Traduce la respuesta HTTP a un estado de la interfaz. `body` es el JSON ya leído (o null si no se pudo). */
export function viewFromResponse(status: number, retryAfter: string | null, body: unknown): GapsView {
  if (status === 401) return { kind: 'unauthorized' }
  if (status === 429) return { kind: 'rate_limited', seconds: parseRetryAfter(retryAfter) }
  if (status < 200 || status >= 300) return { kind: 'error' }
  const data = body as Partial<GapsResponse> | null
  if (!data || typeof data !== 'object') return { kind: 'error' }
  if (data.status === 'ok' && Array.isArray(data.findings) && Array.isArray(data.families) && Array.isArray(data.dimensions)) {
    return { kind: 'ok', data: data as GapsResponse }
  }
  if ((data.status === 'empty' || data.status === 'too_small') && data.guide) return { kind: 'guide', data: data as GapsResponse }
  return { kind: 'error' }
}

export type FindingGroups = { gap: Finding[]; weak: Finding[]; unexplored: Finding[] }

export function groupFindings(findings: readonly Finding[]): FindingGroups {
  const groups: FindingGroups = { gap: [], weak: [], unexplored: [] }
  for (const f of findings) if (f.kind in groups) groups[f.kind].push(f)
  return groups
}

/** Fracción 0..1 a porcentaje entero para mostrar ("12 %"). */
export function percent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100)
}

export function announcementFor(view: GapsView): string {
  switch (view.kind) {
    case 'loading':
      return 'Analizando tu colección.'
    case 'ok':
      return view.data.headline ?? 'Listo: ya podés ver el análisis de tu colección.'
    case 'guide':
      return view.data.guide?.title ?? 'Todavía no hay datos suficientes para analizar.'
    case 'unauthorized':
      return 'Tu sesión venció. Volvé a ingresar.'
    case 'rate_limited':
      return 'Hiciste muchas consultas seguidas. Esperá unos segundos y probá de nuevo.'
    case 'error':
      return 'Algo salió mal. Probá de nuevo.'
    case 'network':
      return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
    default:
      return ''
  }
}

// Color representativo de cada familia: el mismo de los chips de acordes (`accordDotColor`), tomado de un acorde típico de la
// familia. Es solo un color de categoría para distinguir filas: no significa bueno ni malo, y el dato siempre está también en texto.
const FAMILY_REPRESENTATIVE_ACCORD: Readonly<Record<string, string>> = {
  citrico: 'cítrico',
  afrutado: 'afrutado',
  verde: 'verde',
  floral: 'floral',
  empolvado: 'empolvado',
  dulce: 'dulce',
  ambar: 'ámbar',
  amaderado: 'amaderado',
  cuero: 'cuero',
  acuatico: 'acuático',
}

/** Color de una familia por su código, o undefined si no se conoce (la fila queda neutra). */
export function familyColor(code: string): string | undefined {
  const accord = FAMILY_REPRESENTATIVE_ACCORD[code]
  if (!accord) return undefined
  const color = accordDotColor(accord)
  return color === NEUTRAL_DOT_COLOR ? undefined : color
}

// Colores de estación y de día/noche (pedidos por la persona propietaria): invierno celeste, verano anaranjado, día amarillento y
// noche gris oscuro. Primavera y otoño completan la serie. Como los de las familias, son colores de categoría (distinguen filas),
// no un semáforo. La noche es un gris azulado lo bastante claro como para verse sobre el fondo oscuro (contraste de gráficos ≥ 3:1).
const VALUE_COLORS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  season: { primavera: '#8fcf7e', verano: '#f59a3b', otoño: '#b8683a', invierno: '#7cc4ec' },
  dayNight: { dia: '#f2d46b', noche: '#667088' },
}

/** Color de un valor de estación o de día/noche; undefined para duración y estela (quedan neutras). */
export function valueColor(dimension: string, code: string): string | undefined {
  return VALUE_COLORS[dimension]?.[code]
}

/** Frase corta que explica qué género se está mostrando y por qué. */
export function genderHint(gender: GapsResponse['gender']): string {
  const label = gender.options.find((o) => o.value === gender.applied)?.label ?? ''
  const withUnisex = gender.options.find((o) => o.value === gender.applied)?.includesUnisex ?? false
  if (gender.applied === 'todos') return 'Mostrando perfumes de todos los géneros.'
  const scope = withUnisex ? `${label.toLowerCase()} y unisex` : label.toLowerCase()
  return gender.chosen ? `Mostrando perfumes ${scope}.` : `Mostramos perfumes ${scope} porque es lo que predomina en tu colección. Podés cambiarlo.`
}

// ---------------------------------------------------------------------------------------------
// Cuadro para afinar con IA (ADR-010)

export type RefinedList = { summary: string; suggestions: SuggestionOut[]; complete: boolean; hadCriteria: boolean }

export type RefineView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; refined: RefinedList }
  | { kind: 'not_understood'; message: string }
  | { kind: 'unauthorized' }
  | { kind: 'rate_limited'; seconds: number }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'network' }

/** Traduce la respuesta HTTP de `/api/collection/gaps/refine` a un estado de la interfaz. */
export function refineViewFromResponse(status: number, retryAfter: string | null, body: unknown): RefineView {
  if (status === 401) return { kind: 'unauthorized' }
  if (status === 429) return { kind: 'rate_limited', seconds: parseRetryAfter(retryAfter) }
  if (status === 503) return { kind: 'unavailable' }
  if (status < 200 || status >= 300) return { kind: 'error' }
  const data = body as Partial<RefineResponse> | null
  if (!data || typeof data !== 'object') return { kind: 'error' }
  if (data.status === 'not_understood' && typeof data.message === 'string') return { kind: 'not_understood', message: data.message }
  if (data.status === 'ok' && typeof data.summary === 'string' && Array.isArray(data.suggestions)) {
    return { kind: 'ok', refined: { summary: data.summary, suggestions: data.suggestions, complete: data.complete === true, hadCriteria: data.hadCriteria === true } }
  }
  return { kind: 'error' }
}

export function refineAnnouncement(view: RefineView): string {
  switch (view.kind) {
    case 'loading':
      return 'Interpretando tu pedido.'
    case 'ok':
      return view.refined.suggestions.length > 0 ? `Listo: ${view.refined.suggestions.length} sugerencias afinadas.` : 'No encontramos perfumes con ese pedido.'
    case 'not_understood':
      return view.message
    case 'unauthorized':
      return 'Tu sesión venció. Volvé a ingresar.'
    case 'rate_limited':
      return 'Hiciste muchas consultas seguidas. Esperá unos segundos y probá de nuevo.'
    case 'unavailable':
      return 'No pudimos interpretar tu pedido ahora. Probá de nuevo en un rato.'
    case 'error':
      return 'Algo salió mal. Probá de nuevo.'
    case 'network':
      return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
    default:
      return ''
  }
}

/** Ejemplos que rellenan el cuadro (la persona igual tiene que enviarlos). */
export const REFINE_EXAMPLES = ['Lo necesito para una ocasión especial', 'Algo fresco para el verano', 'Me gusta el estilo de Sauvage'] as const
