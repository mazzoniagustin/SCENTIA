// Geometría y ejes del radar de acordes del comparador (RF-03).
//
// Toda la matemática del chart vive aquí como funciones puras, para que el
// componente de la página sea solo markup y esto sea testeable sin DOM:
//   - radarPoints: convierte intensidades 0-100 a puntos (x, y) de un polígono.
//   - buildRadarAxes: unión alfabética de acordes de N perfumes, con corte
//     top-6 si la unión crece más allá de lo legible.
//   - seriesColor: paleta de series validada con el método dataviz (all-pairs
//     ΔE CVD ≥ 9.2 sobre superficie #ffffff, sitio light-only).
//
// Sin dependencias: el SVG lo dibuja la página con estos puntos.

/** Relación perfume-acorde con solo lo que el radar necesita. */
export type RadarAccord = {
  accord: { name: string }
  intensity: number
}

/**
 * Perfume con acordes cargados. Tipo estructural mínimo: acepta el payload de
 * Prisma con `include: { accords: { include: { accord: true } } }` sin acoplar
 * este módulo al cliente generado.
 */
export type RadarPerfume = {
  accords?: ReadonlyArray<RadarAccord> | null
}

/** Punto 2D del polígono, en unidades del viewBox del SVG. */
export type Point = { x: number; y: number }

/** Máximo de ejes antes de recortar: más de 8 vértices degrada la lectura. */
export const RADAR_AXIS_LIMIT = 8

/** Tope de ejes cuando hay que recortar: los 6 acordes más intensos. */
export const RADAR_AXIS_TOP = 6

/**
 * Paleta de series del comparador, orden fijo por posición en `ids`.
 * Slots 1-3: validados all-pairs en ambos modos (ΔE CVD ≥ 9.2). Slot 4:
 * violeta en lugar del amarillo default, que colisiona con el naranja
 * all-pairs (ΔE normal 13.7); violeta pasa con 16.3 sobre #ffffff.
 */
export const SERIES_COLORS: ReadonlyArray<string> = [
  '#2a78d6', // slot 1: azul
  '#eb6834', // slot 2: naranja
  '#1baf7a', // slot 3: aqua (contraste 2.8:1 — cubierto por leyenda con valores)
  '#4a3aa7', // slot 4: violeta
] as const

/** Color de la serie por posición (0-3). Índices fuera de rango → slot 4. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[Math.min(Math.max(index, 0), SERIES_COLORS.length - 1)]
}

/** Ángulo en grados del eje `axisIndex` de `totalAxes` (−90° inicial, horario). */
export function axisAngle(axisIndex: number, totalAxes: number): number {
  return -90 + (360 / totalAxes) * axisIndex
}

/**
 * Punto de un vértice del radar: ángulo inicial -90° (arriba), sentido
 * horario. Exportado para que la página posicione etiquetas de eje y
 * grilla con exactamente la misma matemática que los polígonos.
 */
export function axisPoint(axisIndex: number, totalAxes: number, radius: number, cx: number, cy: number): Point {
  const angle = axisAngle(axisIndex, totalAxes) * (Math.PI / 180)
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

/**
 * Puntos del polígono de una serie: un punto por eje, en el orden de los
 * ejes que devuelve `buildRadarAxes`. `values[i]` es la intensidad 0-100 del
 * eje i (0 = el perfume no tiene el acorde; la página lo marca como ausencia).
 */
export function radarPoints(
  values: ReadonlyArray<number>,
  totalAxes: number,
  radius: number,
  cx: number,
  cy: number,
): Point[] {
  // El radio máximo dibuja el anillo exterior; la escala lineal 0-100 lleva
  // la intensidad a esa fracción del radio.
  return values.map((intensity, index) =>
    axisPoint(index, totalAxes, (Math.max(0, Math.min(100, intensity)) / 100) * radius, cx, cy),
  )
}

/** Acorde nombrado con la intensidad máxima que alcanza entre los perfumes. */
type AxisAccord = { name: string; maxIntensity: number }

/**
 * Ejes del radar: unión alfabética de los acordes de todos los perfumes
 * (orden determinista, independiente del orden de `ids`). Si la unión supera
 * RADAR_AXIS_LIMIT, recorta a los RADAR_AXIS_TOP más intensos (máxima
 * intensidad entre los comparados) — el resto queda para la tabla gemela.
 */
export function buildRadarAxes(perfumes: ReadonlyArray<RadarPerfume>): { axes: string[]; truncated: boolean } {
  const byName = new Map<string, number>()
  for (const perfume of perfumes) {
    for (const { accord, intensity } of perfume.accords ?? []) {
      const current = byName.get(accord.name) ?? 0
      byName.set(accord.name, Math.max(current, intensity))
    }
  }

  const all: AxisAccord[] = [...byName]
    .map(([name, maxIntensity]) => ({ name, maxIntensity }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (all.length > RADAR_AXIS_LIMIT) {
    const top = [...all]
      .sort((a, b) => b.maxIntensity - a.maxIntensity)
      .slice(0, RADAR_AXIS_TOP)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return { axes: top.map((a) => a.name), truncated: true }
  }

  return { axes: all.map((a) => a.name), truncated: false }
}

/**
 * Intensidades de un perfume en cada eje, en el orden de `axes`. Un acorde
 * ausente da 0 — la página lo aclara como ausencia, no como intensidad cero.
 */
export function radarValues(perfume: RadarPerfume, axes: ReadonlyArray<string>): number[] {
  const intensityByAccord = new Map(
    (perfume.accords ?? []).map(({ accord, intensity }) => [accord.name, intensity]),
  )
  return axes.map((name) => intensityByAccord.get(name) ?? 0)
}

/**
 * Path `d` del polígono de una serie (`M x,y L ... Z`), listo para un
 * atributo `points` de <polygon> via `points.join(' ')` del par "x,y".
 */
export function polygonPoints(points: ReadonlyArray<Point>): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}
