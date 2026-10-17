// Cálculos de la auditoría para el superadmin. Puro: recibe números ya agregados (sin ids ni datos personales) y arma lo que se
// muestra. Los promedios son null cuando no hay datos (no se muestra 0 ni NaN).

export type MonthCount = { month: string; count: number }
export type StatusCount = { status: string; count: number }

/** Promedio redondeado a `digits` decimales, o null si no hay observaciones. */
export function average(sum: number, count: number, digits = 1): number | null {
  if (!Number.isFinite(sum) || !Number.isFinite(count) || count <= 0) return null
  const factor = 10 ** digits
  return Math.round((sum / count) * factor) / factor
}

/** Porcentaje entero (0-100) de `part` sobre `total`, o null si no hay total. */
export function percent(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null
  return Math.round((part / total) * 100)
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
}

export type TimelineRow = { month: string; registered: number; deleted: number; net: number }

/**
 * Altas y bajas por mes, sin huecos entre el primer y el último mes con datos (un mes sin movimiento aparece con ceros).
 * Los meses con formato inválido se ignoran. `limit` conserva solo los últimos meses.
 */
export function buildTimeline(registered: readonly MonthCount[], deleted: readonly MonthCount[], limit = 24): TimelineRow[] {
  const reg = new Map<string, number>()
  const del = new Map<string, number>()
  for (const { month, count } of registered) if (MONTH.test(month) && count > 0) reg.set(month, (reg.get(month) ?? 0) + count)
  for (const { month, count } of deleted) if (MONTH.test(month) && count > 0) del.set(month, (del.get(month) ?? 0) + count)

  const months = [...reg.keys(), ...del.keys()].sort()
  if (months.length === 0) return []

  const rows: TimelineRow[] = []
  for (let month = months[0]; month <= months[months.length - 1]; month = nextMonth(month)) {
    const r = reg.get(month) ?? 0
    const d = del.get(month) ?? 0
    rows.push({ month, registered: r, deleted: d, net: r - d })
  }
  return rows.slice(-Math.max(limit, 1))
}

export type StatusTotals = { owned: number; sampled: number; wishlist: number; disliked: number; total: number }

/** Reparte los conteos por estado de colección; un estado desconocido no suma. */
export function totalsByStatus(rows: readonly StatusCount[]): StatusTotals {
  const totals: StatusTotals = { owned: 0, sampled: 0, wishlist: 0, disliked: 0, total: 0 }
  for (const { status, count } of rows) {
    if (!(count > 0)) continue
    if (status === 'OWNED') totals.owned += count
    else if (status === 'SAMPLED') totals.sampled += count
    else if (status === 'WISHLIST') totals.wishlist += count
    else if (status === 'DISLIKED') totals.disliked += count
    else continue
    totals.total += count
  }
  return totals
}

/** Ancho (0-100) de una barra respecto del máximo de la serie; 0 si no hay máximo. */
export function barWidth(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0
  return Math.min(100, Math.round((value / max) * 100))
}

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-10" → "oct 2026". Un valor que no es un mes se devuelve tal cual. */
export function monthLabel(month: string): string {
  return MONTH.test(month) ? `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}` : month
}

/** Cantidad de páginas para `total` filas (mínimo 1, para que una lista vacía igual tenga la página 1). */
export function pageCount(total: number, pageSize: number): number {
  if (!(total > 0) || !(pageSize > 0)) return 1
  return Math.ceil(total / pageSize)
}

/** Página pedida en la URL: entero entre 1 y `pages`; cualquier otra cosa (vacío, texto, 0, negativo, decimal) es la 1. */
export function parsePage(raw: string | string[] | undefined, pages: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !/^\d{1,6}$/.test(value)) return 1
  return Math.min(Math.max(Number(value), 1), Math.max(pages, 1))
}
