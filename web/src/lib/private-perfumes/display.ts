// Cómo se muestra un perfume en pantallas que mezclan el catálogo con los perfumes propios. La marca de un perfume propio es
// opcional (puede ser ''), y su ficha es privada (`/perfumes/[id]` responde 404 para ellos). Lógica pura.

/** Ficha a la que lleva el nombre de un perfume: la privada para uno propio, la pública para el resto. */
export function perfumeHref(perfume: { perfumeId: string; own?: boolean }): string {
  return perfume.own ? `/mi-coleccion/${perfume.perfumeId}` : `/perfumes/${perfume.perfumeId}`
}

/** "Marca Nombre", o solo el nombre si no hay marca. */
export function brandAndName(brand: string, name: string): string {
  return [brand.trim(), name].filter(Boolean).join(' ')
}

/** "Nombre de Marca", o solo el nombre si no hay marca. */
export function nameOfBrand(name: string, brand: string): string {
  const b = brand.trim()
  return b ? `${name} de ${b}` : name
}

/** "(Marca)", o '' si no hay marca. */
export function brandInParens(brand: string): string {
  const b = brand.trim()
  return b ? `(${b})` : ''
}
