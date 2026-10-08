import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRadarAxes,
  polygonPoints,
  radarPoints,
  radarValues,
  seriesColor,
  SERIES_COLORS,
  RADAR_AXIS_LIMIT,
  RADAR_AXIS_TOP,
  type RadarPerfume,
} from './radar.ts'

// Comparación tolerante: los valores esperados provienen del mockup del
// documento de diseño, redondeados a 1 decimal — la tolerancia cubre ese
// redondeo (±0.05), no errores de punto flotante.
function assertPoint(actual: { x: number; y: number }, ex: number, ey: number): void {
  assert.ok(
    Math.abs(actual.x - ex) < 0.051 && Math.abs(actual.y - ey) < 0.051,
    `se esperaba (${ex}, ${ey}), se obtuvo (${actual.x}, ${actual.y})`,
  )
}

function perfumeWith(accords: Array<[string, number]>): RadarPerfume {
  return { accords: accords.map(([name, intensity]) => ({ accord: { name }, intensity })) }
}

describe('radarPoints', () => {
  it('eje 0 con intensidad 100 apunta hacia arriba (−90°)', () => {
    const [p] = radarPoints([100], 1, 180, 240, 240)
    assertPoint(p, 240, 60)
  })

  it('intensidad 50 en 5 ejes: vértice 0 a mitad del radio superior', () => {
    const [p] = radarPoints([50], 5, 180, 240, 240)
    assertPoint(p, 240, 150)
  })

  it('5 ejes a intensidad 100: pentágono con vértice 1 a 72° horario', () => {
    // Regresión de la geometría del mockup aprobado: mismos puntos que el
    // documento de diseño (cos/sen de -90+72i grados, radio 180, centro 240).
    const points = radarPoints([100, 100, 100, 100, 100], 5, 180, 240, 240)
    const expected: Array<[number, number]> = [
      [240.0, 60.0],
      [411.2, 184.4],
      [345.8, 385.6],
      [134.2, 385.6],
      [68.8, 184.4],
    ]
    points.forEach((p, i) => assertPoint(p, expected[i][0], expected[i][1]))
  })

  it('8 ejes: vértice 1 a 45° horario desde arriba', () => {
    // -90 + 360/8 = -45° → cos(−45°)=√2/2, sin(−45°)=−√2/2
    const [, p1] = radarPoints([100, 100], 8, 100, 0, 0)
    assertPoint(p1, 100 * Math.cos(-Math.PI / 4), 100 * Math.sin(-Math.PI / 4))
  })

  it('intensidad 0 → centro exacto', () => {
    const [p] = radarPoints([0], 5, 180, 240, 240)
    assertPoint(p, 240, 240)
  })

  it('clamp: valores fuera de 0-100 no salen del anillo', () => {
    const [over] = radarPoints([150], 3, 100, 0, 0)
    const [under] = radarPoints([-20], 3, 100, 0, 0)
    assertPoint(over, 0, -100) // 150 clamped a 100
    assertPoint(under, 0, 0) // -20 clamped a 0
  })

  it('N=2 series: 4 ejes con radios distintos, cada polígono independiente', () => {
    const a = radarPoints([100, 50, 0, 25], 4, 100, 50, 50)
    const b = radarPoints([50, 100, 25, 0], 4, 100, 50, 50)
    // Serie a: vértice 0 al tope; serie b: vértice 0 a mitad
    assertPoint(a[0], 50, -50)
    assertPoint(b[0], 50, 0)
    // Serie a: vértice 2 (180°) al centro por intensidad 0
    assertPoint(a[2], 50, 50)
  })
})

describe('buildRadarAxes', () => {
  it('unión de acordes en orden alfabético, sin duplicados', () => {
    const a = perfumeWith([
      ['cítrico', 70],
      ['amaderado', 65],
    ])
    const b = perfumeWith([['amaderado', 80], ['dulce', 60]])
    const { axes, truncated } = buildRadarAxes([a, b])
    // Collation español: la c con tilde de "cítrico" ordena como c, antes de d
    assert.deepEqual(axes, ['amaderado', 'cítrico', 'dulce'])
    assert.equal(truncated, false)
  })

  it('determinista: el resultado no depende del orden de los perfumes', () => {
    const a = perfumeWith([['especiado', 50]])
    const b = perfumeWith([['floral', 70], ['cítrico', 60]])
    assert.deepEqual(
      buildRadarAxes([a, b]).axes,
      buildRadarAxes([b, a]).axes,
    )
  })

  it('≤ 8 acordes: sin corte', () => {
    const many = perfumeWith(
      Array.from({ length: RADAR_AXIS_LIMIT }, (_, i) => [`a${i}`, 10 * (i + 1)]),
    )
    const { axes, truncated } = buildRadarAxes([many])
    assert.equal(axes.length, RADAR_AXIS_LIMIT)
    assert.equal(truncated, false)
  })

  it('> 8 acordes: recorta a top-6 por intensidad máxima, reordenado alfabético', () => {
    const many = perfumeWith([
      ['bajo1', 10], ['bajo2', 20], ['bajo3', 30],
      ['alto1', 90], ['alto2', 85], ['alto3', 80], ['alto4', 75], ['alto5', 70],
      ['medio', 50],
    ])
    const { axes, truncated } = buildRadarAxes([many])
    assert.deepEqual(axes, ['alto1', 'alto2', 'alto3', 'alto4', 'alto5', 'medio'])
    assert.equal(truncated, true)
    assert.equal(axes.length, RADAR_AXIS_TOP)
  })

  it('la intensidad del corte es el máximo ENTRE perfumes (punta un perfume débil)', () => {
    const weak = perfumeWith([['exclusivo-de-debil', 90]])
    const strong = perfumeWith(
      Array.from({ length: 10 }, (_, i) => [`acorde-${i}`, 60]),
    )
    const { axes } = buildRadarAxes([weak, strong])
    // 10 acordes a 60 + 1 a 90 → el top-6 incluye al de 90
    assert.ok(axes.includes('exclusivo-de-debil'))
  })
})

describe('radarValues', () => {
  it('intensidades en el orden de los ejes; ausente → 0', () => {
    const p = perfumeWith([['dulce', 85], ['amaderado', 60]])
    const values = radarValues(p, ['amaderado', 'dulce', 'floral'])
    assert.deepEqual(values, [60, 85, 0])
  })
})

describe('seriesColor', () => {
  it('slots en orden fijo; máximo 4 series → índice fuera de rango cae al último', () => {
    assert.equal(seriesColor(0), '#2a78d6')
    assert.equal(seriesColor(1), '#eb6834')
    assert.equal(seriesColor(2), '#1baf7a')
    assert.equal(seriesColor(3), '#4a3aa7')
    assert.equal(seriesColor(7), '#4a3aa7') // defensivo: nunca undefined
    assert.equal(SERIES_COLORS.length, 4)
  })
})

describe('polygonPoints', () => {
  it('serializa "x,y" con 1 decimal', () => {
    const d = polygonPoints([
      { x: 240.04, y: 60.02 },
      { x: 68.8, y: 184.44 },
    ])
    assert.equal(d, '240.0,60.0 68.8,184.4')
  })

  it('regresión del mockup aprobado: pentágono de Sauvage', () => {
    // Intensidades del documento de diseño: amaderado 68, cítrico 72, dulce 30,
    // especiado 62, floral 20 (orden alfabético de ejes), radio 180, centro 240.
    const points = radarPoints([68, 72, 30, 62, 20], 5, 180, 240, 240)
    assert.equal(
      polygonPoints(points),
      '240.0,117.6 363.3,200.0 271.7,283.7 174.4,330.3 205.8,228.9',
    )
  })
})
