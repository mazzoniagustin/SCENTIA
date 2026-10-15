import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  coveredLabel,
  dimensionGapText,
  dimensionUnexploredText,
  dimensionWeakText,
  familyGapText,
  familyUnexploredText,
  familyWeakText,
  guideFor,
  insufficientDataText,
} from './texts.ts'

describe('textos de plantilla', () => {
  it('familia: hueco, débil y no explorado, con porcentajes redondeados', () => {
    assert.equal(familyGapText('citrico', 6, 0.364), 'Ninguno de tus 6 perfumes es de la familia «Cítrico», que está en el 36 % del catálogo.')
    assert.equal(familyWeakText('floral', 1, 6, 0.5), 'Poca presencia de «Floral»: 1 de tus 6 perfumes (17 %), frente al 50 % del catálogo.')
    assert.equal(familyUnexploredText('cuero', 0.198), 'Todavía no exploraste «Cuero y ahumado», una familia poco común (el 20 % del catálogo).')
  })

  it('dimensiones: día/noche se llama así, no "ocasión"', () => {
    assert.equal(dimensionGapText('dayNight', 'noche', 6), 'Ninguno de tus 6 perfumes está entre los pensados para la noche.')
    assert.equal(dimensionGapText('season', 'invierno', 4), 'Ninguno de tus 4 perfumes está entre los de invierno.')
    assert.equal(dimensionGapText('duration', 'larga', 5), 'Ninguno de tus 5 perfumes está entre los con duración larga.')
    assert.equal(dimensionWeakText('dayNight', 'noche', 1, 8, 0.52), 'Pocos perfumes pensados para la noche: 1 de 8 (13 %), frente al 52 % del catálogo.')
    assert.equal(dimensionUnexploredText('sillage', 'fuerte', 0.028), 'Todavía no exploraste los perfumes con estela fuerte, poco comunes en el catálogo (3 %).')
    for (const text of [dimensionGapText('dayNight', 'dia', 3), dimensionWeakText('dayNight', 'dia', 1, 7, 0.9)]) assert.doesNotMatch(text, /ocasi/i)
  })

  it('datos insuficientes', () => {
    assert.equal(insufficientDataText('duration', 0.75), 'No analizamos «Duración»: falta el dato en el 75 % de tus perfumes.')
  })

  it('guías: singular/plural y casos de la colección', () => {
    assert.match(guideFor('too_small', 1, 0).text, /Tenés 1 perfume entre/)
    assert.match(guideFor('too_small', 2, 0).text, /Tenés 2 perfumes entre/)
    assert.match(guideFor('empty', 0, 0).text, /al menos 3 perfumes/)
    assert.match(guideFor('empty', 0, 4).text, /deseados o descartados/)
    assert.deepEqual(guideFor('empty', 0, 0).links.map((l) => l.href), ['/perfumes', '/quiz'])
  })

  it('etiquetas de lo que cubre un candidato', () => {
    assert.equal(coveredLabel({ kind: 'family', family: 'ambar' }), 'Ámbar y especiado')
    assert.equal(coveredLabel({ kind: 'dimension', dimension: 'season', value: 'otoño' }), 'Estación: Otoño')
  })
})
