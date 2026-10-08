import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createTtlCache } from './ttl-cache.ts'

describe('createTtlCache', () => {
  it('calcula una vez y reutiliza hasta que vence', async () => {
    let t = 0
    let calls = 0
    const cache = createTtlCache<number>({ ttlMs: 1000, now: () => t })
    const compute = async () => ++calls
    assert.equal(await cache.getOrCompute('a', compute), 1)
    assert.equal(await cache.getOrCompute('a', compute), 1)
    t = 999
    assert.equal(await cache.getOrCompute('a', compute), 1)
    t = 1000
    assert.equal(await cache.getOrCompute('a', compute), 2)
    assert.equal(calls, 2)
  })

  it('cada clave tiene su propio valor', async () => {
    const cache = createTtlCache<string>({ ttlMs: 1000 })
    assert.equal(await cache.getOrCompute('x', async () => 'X'), 'X')
    assert.equal(await cache.getOrCompute('y', async () => 'Y'), 'Y')
    assert.equal(await cache.getOrCompute('x', async () => 'otro'), 'X')
  })

  it('solicitudes simultáneas comparten una sola consulta', async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 })
    let calls = 0
    const slow = async () => {
      calls++
      await new Promise((r) => setTimeout(r, 20))
      return 42
    }
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => cache.getOrCompute('k', slow)))
    assert.deepEqual(results, [42, 42, 42, 42, 42])
    assert.equal(calls, 1)
  })

  it('un error no se cachea y la próxima solicitud reintenta', async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 })
    let calls = 0
    await assert.rejects(cache.getOrCompute('k', async () => { calls++; throw new Error('falla') }), /falla/)
    assert.equal(await cache.getOrCompute('k', async () => { calls++; return 7 }), 7)
    assert.equal(calls, 2)
  })

  it('respeta el tope de entradas descartando primero las vencidas y luego la más antigua', async () => {
    let t = 0
    const cache = createTtlCache<number>({ ttlMs: 100, maxEntries: 2, now: () => t })
    await cache.getOrCompute('a', async () => 1)
    t = 50
    await cache.getOrCompute('b', async () => 2)
    t = 120 // 'a' venció, 'b' no
    await cache.getOrCompute('c', async () => 3)
    assert.equal(cache.size, 2)
    let recomputed = false
    await cache.getOrCompute('b', async () => { recomputed = true; return 0 })
    assert.equal(recomputed, false, 'b sigue en caché')
    t = 130
    await cache.getOrCompute('d', async () => 4) // lleno y nada vencido: sale la más antigua (b)
    assert.equal(cache.size, 2)
  })

  it('cacheIf evita guardar valores que no corresponde (ej. "no encontrado")', async () => {
    const cache = createTtlCache<number | null>({ ttlMs: 1000, cacheIf: (v) => v !== null })
    let calls = 0
    assert.equal(await cache.getOrCompute('k', async () => { calls++; return null }), null)
    assert.equal(await cache.getOrCompute('k', async () => { calls++; return 5 }), 5)
    assert.equal(await cache.getOrCompute('k', async () => { calls++; return 9 }), 5)
    assert.equal(calls, 2)
  })
})
