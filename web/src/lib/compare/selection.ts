// Selección de perfumes para comparar. Lógica pura (sin navegador): la persistencia vive en el store del cliente.
// Decisión de diseño: la selección se guarda en el navegador (no en la URL) para que sobreviva a nuevas búsquedas,
// cambios de página y recargas; un formulario GET (la búsqueda) descarta cualquier parámetro que no incluya.

export const MAX_COMPARE = 4
export const MIN_COMPARE = 2
const MAX_ID_LENGTH = 64
const MAX_TEXT_LENGTH = 200

export type CompareItem = { id: string; brand: string; name: string }

const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** Lee lo guardado (texto JSON) y descarta lo inválido, los repetidos y lo que exceda el máximo. Nunca lanza. */
export function parseSelection(raw: string | null | undefined): CompareItem[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  const items: CompareItem[] = []
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, brand, name } = entry as Record<string, unknown>
    if (!isText(id, MAX_ID_LENGTH) || !isText(brand, MAX_TEXT_LENGTH) || !isText(name, MAX_TEXT_LENGTH) || seen.has(id)) continue
    seen.add(id)
    items.push({ id, brand, name })
    if (items.length === MAX_COMPARE) break
  }
  return items
}

export const serializeSelection = (items: readonly CompareItem[]): string => JSON.stringify(items.slice(0, MAX_COMPARE))

export const isSelected = (items: readonly CompareItem[], id: string) => items.some((i) => i.id === id)
export const isFull = (items: readonly CompareItem[]) => items.length >= MAX_COMPARE

/** Agrega el perfume si no estaba y hay lugar; si ya estaba, lo quita. Devuelve una lista nueva. */
export function toggleItem(items: readonly CompareItem[], item: CompareItem): CompareItem[] {
  if (isSelected(items, item.id)) return items.filter((i) => i.id !== item.id)
  if (isFull(items)) return [...items]
  return [...items, item]
}

export const removeItem = (items: readonly CompareItem[], id: string): CompareItem[] => items.filter((i) => i.id !== id)

/** Enlace a la página del comparador, o null si todavía no hay suficientes perfumes. */
export function compareHref(items: readonly CompareItem[]): string | null {
  if (items.length < MIN_COMPARE) return null
  return `/perfumes/compare?ids=${items.map((i) => encodeURIComponent(i.id)).join(',')}`
}
