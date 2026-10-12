import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildCsp, CSP_HEADER_NAME } from './csp.ts'

const nonce = 'abc123=='
const dirs = (csp: string) => new Map(csp.split('; ').map((d) => [d.split(' ')[0], d] as const))

describe('buildCsp', () => {
  const prod = dirs(buildCsp({ nonce, isDev: false }))
  const dev = dirs(buildCsp({ nonce, isDev: true }))

  it('incluye cada directiva esperada', () => {
    for (const name of ['default-src', 'script-src', 'style-src', 'style-src-attr', 'img-src', 'font-src', 'connect-src', 'form-action', 'frame-ancestors', 'object-src', 'base-uri']) {
      assert.ok(prod.has(name), name)
    }
    assert.equal(prod.get('default-src'), "default-src 'self'")
    assert.equal(prod.get('frame-ancestors'), "frame-ancestors 'none'")
    assert.equal(prod.get('object-src'), "object-src 'none'")
    assert.equal(prod.get('base-uri'), "base-uri 'self'")
    assert.equal(prod.get('form-action'), "form-action 'self'")
    assert.equal(prod.get('font-src'), "font-src 'self'")
    assert.equal(prod.get('style-src-attr'), "style-src-attr 'unsafe-inline'")
  })

  it('el nonce está en script-src y style-src', () => {
    assert.ok(prod.get('script-src')!.includes(`'nonce-${nonce}'`))
    assert.ok(prod.get('style-src')!.includes(`'nonce-${nonce}'`))
    assert.ok(prod.get('script-src')!.includes("'strict-dynamic'"))
  })

  it("'unsafe-eval' solo en desarrollo", () => {
    assert.ok(!prod.get('script-src')!.includes('unsafe-eval'))
    assert.ok(dev.get('script-src')!.includes("'unsafe-eval'"))
  })

  it("script-src y style-src no usan 'unsafe-inline'", () => {
    assert.ok(!prod.get('script-src')!.includes('unsafe-inline'))
    assert.ok(!dev.get('script-src')!.includes('unsafe-inline'))
    assert.ok(!prod.get('style-src')!.includes('unsafe-inline'))
  })

  it('img-src deriva los hosts permitidos', () => {
    assert.equal(prod.get('img-src'), "img-src 'self' data: blob: https://fimgs.net")
  })

  it('upgrade-insecure-requests solo en producción y con la política bloqueante', () => {
    assert.ok(!prod.has('upgrade-insecure-requests'), 'Report-Only: el navegador la ignora y avisa')
    assert.ok(dirs(buildCsp({ nonce, isDev: false, enforce: true })).has('upgrade-insecure-requests'))
    assert.ok(!dirs(buildCsp({ nonce, isDev: true, enforce: true })).has('upgrade-insecure-requests'))
    assert.ok(!dev.has('upgrade-insecure-requests'))
  })

  it('connect-src suma Supabase solo si se indica y es válido', () => {
    assert.equal(prod.get('connect-src'), "connect-src 'self'")
    const withSb = dirs(buildCsp({ nonce, isDev: false, supabaseUrl: 'https://abc.supabase.co/rest/v1' }))
    assert.equal(withSb.get('connect-src'), "connect-src 'self' https://abc.supabase.co")
    const bad = dirs(buildCsp({ nonce, isDev: false, supabaseUrl: 'javascript:alert(1)' }))
    assert.equal(bad.get('connect-src'), "connect-src 'self'")
  })

  it('usa el modo Report-Only', () => {
    assert.equal(CSP_HEADER_NAME, 'Content-Security-Policy-Report-Only')
  })
})
