// Cuentas puras del movimiento de "¿Qué le falta a mi colección?": curvas, conteo animado, escalonado e inclinación de las
// tarjetas. Sin React ni DOM, para poder probarlas con node:test. El movimiento nunca es lo único que dice algo: el valor final
// siempre está también en el texto.

/** Curva de salida suave (arranca rápido y frena): t entre 0 y 1. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t)
  return 1 - (1 - x) ** 3
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * Avance (0..1) de la fila `index` cuando pasaron `elapsedMs`: cada fila arranca `stepMs` después de la anterior y dura
 * `durationMs`. Con `elapsedMs` infinito (sin movimiento) devuelve 1.
 */
export function staggerProgress(elapsedMs: number, index: number, stepMs: number, durationMs: number): number {
  if (elapsedMs === Number.POSITIVE_INFINITY) return 1
  if (!Number.isFinite(elapsedMs) || durationMs <= 0) return 0
  return easeOutCubic((elapsedMs - Math.max(0, index) * stepMs) / durationMs)
}

/** Tiempo total hasta que termina la última fila del escalonado. */
export function staggerTotalMs(rows: number, stepMs: number, durationMs: number): number {
  return Math.max(0, rows - 1) * stepMs + durationMs
}

/** Valor entero que muestra un conteo que va de 0 a `target` con el avance `progress` (0..1). Nunca pasa de `target`. */
export function countAt(target: number, progress: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0
  return Math.min(target, Math.round(target * clamp01(progress)))
}

export type Tilt = {
  /** Giro alrededor del eje horizontal, en grados (positivo: la parte de arriba se aleja). */
  rotateX: number
  /** Giro alrededor del eje vertical, en grados. */
  rotateY: number
  /** Posición del cursor dentro de la tarjeta, en porcentaje (para el brillo). */
  glowX: number
  glowY: number
}

/**
 * Inclinación de una tarjeta según dónde está el cursor. `x` e `y` son relativos a la esquina de la tarjeta (en px) y
 * `width`/`height` su tamaño. Máximo `maxDeg` hacia cada lado; el centro no inclina. Con tamaño nulo no inclina.
 */
export function tiltFor(x: number, y: number, width: number, height: number, maxDeg = 6): Tilt {
  if (!(width > 0) || !(height > 0)) return { rotateX: 0, rotateY: 0, glowX: 50, glowY: 50 }
  const nx = clamp01(x / width)
  const ny = clamp01(y / height)
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    rotateX: round((0.5 - ny) * 2 * maxDeg) + 0,
    rotateY: round((nx - 0.5) * 2 * maxDeg) + 0,
    glowX: round(nx * 100),
    glowY: round(ny * 100),
  }
}

/** Palabras de un texto, para animarlas una por una sin perder el texto original. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0)
}
