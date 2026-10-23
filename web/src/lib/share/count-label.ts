// Texto de cantidad de perfumes de una lista compartible. Lógica pura.

/** «Sin perfumes», «1 perfume», «12 perfumes». */
export function perfumeCountLabel(count: number): string {
  if (count <= 0) return 'Sin perfumes'
  return count === 1 ? '1 perfume' : `${count} perfumes`
}
