// Helpers puros del índice de marcas (sin base de datos, para poder probarlos).

export type BrandEntry = { brand: string; count: number }

/** Letra del índice: primera letra sin acentos, en mayúscula; lo que no es letra va a "#". */
export function indexLetter(brand: string): string {
  const letter = brand.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /^[A-Z]$/.test(letter) ? letter : '#'
}

export type BrandGroup = { letter: string; brands: BrandEntry[] }

/** Agrupa por letra (orden A-Z y "#" al final), dentro de cada letra por nombre sin acentos. */
export function groupByLetter(entries: readonly BrandEntry[]): BrandGroup[] {
  const groups = new Map<string, BrandEntry[]>()
  for (const entry of entries) {
    const letter = indexLetter(entry.brand)
    groups.set(letter, [...(groups.get(letter) ?? []), entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, brands]) => ({
      letter,
      brands: [...brands].sort((x, y) => x.brand.localeCompare(y.brand, 'es', { sensitivity: 'base' })),
    }))
}

/** Filtra por texto (sin acentos ni mayúsculas) para la búsqueda de marcas. */
export function filterBrands(entries: readonly BrandEntry[], query: string): BrandEntry[] {
  const norm = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(query.trim())
  return q ? entries.filter((e) => norm(e.brand).includes(q)) : [...entries]
}

/** Letra pedida en la URL ("a" → "A"; "otros" o "#" → "#"); null si no es una letra válida del índice. */
export function parseLetter(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (value === '#' || value.toLowerCase() === 'otros') return '#'
  return /^[A-Za-z]$/.test(value) ? value.toUpperCase() : null
}

/** Parámetro de URL de una letra del índice ("#" se escribe "otros"). */
export const letterParam = (letter: string) => (letter === '#' ? 'otros' : letter)
