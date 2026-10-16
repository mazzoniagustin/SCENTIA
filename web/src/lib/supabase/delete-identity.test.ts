import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { deleteIdentityWith } from './delete-identity.ts'

const ok = async () => ({ error: null })

describe('deleteIdentityWith', () => {
  it('sin clave de servicio no llama a Supabase y queda "skipped"', async () => {
    let calls = 0
    const r = await deleteIdentityWith({ serviceKey: undefined, supabaseId: 'sb-1', remove: async () => { calls++; return { error: null } } })
    assert.deepEqual(r, { status: 'skipped' })
    assert.equal(calls, 0)
  })

  it('con clave vacía también queda "skipped"', async () => {
    assert.deepEqual(await deleteIdentityWith({ serviceKey: '', supabaseId: 'sb-1', remove: ok }), { status: 'skipped' })
  })

  it('sin supabaseId queda "skipped"', async () => {
    assert.deepEqual(await deleteIdentityWith({ serviceKey: 'k', supabaseId: null, remove: ok }), { status: 'skipped' })
  })

  it('con clave e id llama con el id y queda "deleted"', async () => {
    const ids: string[] = []
    const r = await deleteIdentityWith({ serviceKey: 'k', supabaseId: 'sb-1', remove: async (id) => { ids.push(id); return { error: null } } })
    assert.deepEqual(r, { status: 'deleted' })
    assert.deepEqual(ids, ['sb-1'])
  })

  it('si Supabase devuelve error queda "failed" con el mensaje', async () => {
    const r = await deleteIdentityWith({ serviceKey: 'k', supabaseId: 'sb-1', remove: async () => ({ error: { message: 'Invalid API key' } }) })
    assert.deepEqual(r, { status: 'failed', detail: 'Invalid API key' })
  })

  it('si la llamada lanza (red caída) queda "failed", sin propagar el error', async () => {
    const r = await deleteIdentityWith({ serviceKey: 'k', supabaseId: 'sb-1', remove: async () => { throw new Error('fetch failed') } })
    assert.deepEqual(r, { status: 'failed', detail: 'fetch failed' })
  })

  it('el detalle de un fallo no incluye la clave de servicio', async () => {
    const r = await deleteIdentityWith({ serviceKey: 'SUPER-SECRETA', supabaseId: 'sb-1', remove: async () => ({ error: { message: 'boom' } }) })
    assert.ok(!JSON.stringify(r).includes('SUPER-SECRETA'))
  })
})
