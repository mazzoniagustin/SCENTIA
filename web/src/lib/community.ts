// Etiquetas para las escalas votadas por la comunidad (dataset de Kaggle). Lógica pura.

export const LONGEVITY_LABELS = ['Muy débil', 'Débil', 'Moderada', 'Larga', 'Eterna'] as const
export const SILLAGE_LABELS = ['Íntima', 'Moderada', 'Fuerte', 'Enorme'] as const
export const PRICE_VALUE_LABELS = ['Muy caro', 'Caro', 'Aceptable', 'Buen precio', 'Excelente precio'] as const

/** Etiqueta de la posición más cercana de una escala 1..N (valores fuera de rango se acotan). */
export function scaleLabel(value: number, labels: readonly string[]): string {
  const index = Math.max(1, Math.min(labels.length, Math.round(value))) - 1
  return labels[index]
}

/** Porcentaje (0-100, entero) de `value` sobre `max` en una escala 1..max; 1 = 0 %, max = 100 %. */
export function scalePercent(value: number, max: number): number {
  if (max <= 1) return 0
  return Math.round(Math.max(0, Math.min(1, (value - 1) / (max - 1))) * 100)
}

/** Reparte votos en porcentajes enteros sobre el total (0 votos → todo 0). */
export function shares(votes: Record<string, number>): Record<string, number> {
  const total = Object.values(votes).reduce((a, b) => a + b, 0)
  return Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 100) : 0]))
}
