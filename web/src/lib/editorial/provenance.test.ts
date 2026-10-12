import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { provenanceProblems, type ProvenanceInput } from './provenance.ts'

const ok: ProvenanceInput = {
  source: 'kaggle:x',
  imageUrl: 'https://fimgs.net/mdimg/perfume/375x500.1.jpg',
  imageSource: 'Fragrantica',
  imageSourceUrl: 'https://www.fragrantica.com/perfume/a/b-1.html',
}

describe('provenanceProblems', () => {
  it('completa: sin problemas', () => {
    assert.deepEqual(provenanceProblems(ok), [])
  })
  it('sin source se rechaza', () => {
    assert.deepEqual(provenanceProblems({ ...ok, source: ' ' }), ['falta source'])
    assert.deepEqual(provenanceProblems({ ...ok, source: null }), ['falta source'])
  })
  it('sin imagen no exige datos de imagen (incluida la retirada)', () => {
    assert.deepEqual(provenanceProblems({ source: 's', imageUrl: null, imageSource: null, imageSourceUrl: null }), [])
    assert.deepEqual(provenanceProblems({ source: 's', imageUrl: null, imageSource: 'removed', imageSourceUrl: null }), [])
  })
  it('con imagen exige imageSource e imageSourceUrl', () => {
    assert.deepEqual(provenanceProblems({ ...ok, imageSource: null }), ['falta imageSource'])
    assert.deepEqual(provenanceProblems({ ...ok, imageSourceUrl: null }), ['falta imageSourceUrl'])
  })
  it('hosts no permitidos', () => {
    assert.ok(provenanceProblems({ ...ok, imageUrl: 'https://evil.example/a.jpg' }).length > 0)
    assert.ok(provenanceProblems({ ...ok, imageUrl: 'http://fimgs.net/a.jpg' }).length > 0)
    assert.ok(provenanceProblems({ ...ok, imageSourceUrl: 'https://evil.example/p' }).length > 0)
  })
  it('acumula varios motivos', () => {
    assert.equal(provenanceProblems({ source: null, imageUrl: ok.imageUrl, imageSource: null, imageSourceUrl: null }).length, 3)
  })
})
