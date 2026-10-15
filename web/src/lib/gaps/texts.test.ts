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
  headlineLabel,
  headlineText,
  insufficientDataText,
} from './texts.ts'

describe('textos de plantilla', () => {
  it('familia: hueco, débil y no explorado hablan de la colección, sin comparar con el catálogo', () => {
    assert.equal(familyGapText('citrico', 6), 'Ninguno de tus 6 perfumes es de la familia «Cítrico».')
    assert.equal(familyWeakText('floral', 1, 6), 'Poca presencia de «Floral»: 1 de tus 6 perfumes (17 %).')
    assert.equal(familyUnexploredText('cuero'), 'Todavía no exploraste «Cuero y ahumado», un rincón para curiosear.')
    for (const text of [familyGapText('citrico', 6), familyWeakText('floral', 1, 6), familyUnexploredText('cuero')]) {
      assert.doesNotMatch(text, /cat[aá]logo/i)
    }
  })

  it('dimensiones: día/noche se llama así, no "ocasión"; sin comparar con el catálogo', () => {
    assert.equal(dimensionGapText('dayNight', 'noche', 6), 'Ninguno de tus 6 perfumes está entre los pensados para la noche.')
    assert.equal(dimensionGapText('season', 'invierno', 4), 'Ninguno de tus 4 perfumes está entre los de invierno.')
    assert.equal(dimensionGapText('duration', 'larga', 5), 'Ninguno de tus 5 perfumes está entre los con duración larga.')
    assert.equal(dimensionWeakText('dayNight', 'noche', 1, 8), 'Pocos perfumes pensados para la noche: 1 de 8 (13 %).')
    assert.equal(dimensionUnexploredText('sillage', 'fuerte'), 'Todavía no exploraste los perfumes con estela fuerte.')
    for (const text of [dimensionGapText('dayNight', 'dia', 3), dimensionWeakText('dayNight', 'dia', 1, 7), dimensionUnexploredText('duration', 'corta')]) {
      assert.doesNotMatch(text, /ocasi|cat[aá]logo/i)
    }
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

  it('etiquetas de lo que cubre un candidato, sin repetir la dimensión', () => {
    assert.equal(coveredLabel({ kind: 'family', family: 'ambar' }), 'Ámbar y especiado')
    assert.equal(coveredLabel({ kind: 'dimension', dimension: 'season', value: 'otoño' }), 'Estación: Otoño')
    assert.equal(coveredLabel({ kind: 'dimension', dimension: 'duration', value: 'larga' }), 'Duración larga')
    assert.equal(coveredLabel({ kind: 'dimension', dimension: 'dayNight', value: 'noche' }), 'Para la noche')
    assert.equal(coveredLabel({ kind: 'dimension', dimension: 'dayNight', value: 'dia' }), 'Para el día')
  })

  it('titular: lo que menos exploró, entre comillas, sin comparar con el catálogo', () => {
    const floral = headlineLabel('family', 'floral')
    const powder = headlineLabel('family', 'empolvado')
    assert.equal(headlineText(6, [floral, powder]), 'Lo que menos exploraste: «Floral» y «Empolvado y almizclado».')
    assert.equal(headlineText(6, [floral]), 'Lo que menos exploraste: «Floral».')
    assert.equal(headlineText(6, [floral, powder, headlineLabel('season', 'invierno')]), 'Lo que menos exploraste: «Floral», «Empolvado y almizclado» y «perfumes de invierno».')
    assert.equal(headlineText(6, []), 'No encontramos huecos en tus 6 perfumes con lo que podemos medir.')
    assert.doesNotMatch(headlineText(6, [floral, powder]), /cat[aá]logo/i)
  })

  it('titular con más de 4 áreas: las primeras 4 y cuántas más', () => {
    const labels = ['floral', 'citrico', 'verde', 'dulce', 'cuero', 'acuatico'].map((f) => headlineLabel('family', f))
    assert.equal(headlineText(9, labels), 'Lo que menos exploraste: «Floral», «Cítrico», «Verde y aromático», «Dulce y gourmand» y 2 más.')
  })

  it('etiquetas del titular para día/noche y duración', () => {
    assert.equal(headlineLabel('dayNight', 'noche'), '«perfumes para la noche»')
    assert.equal(headlineLabel('duration', 'larga'), '«duración larga»')
  })
})
