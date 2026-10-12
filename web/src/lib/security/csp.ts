// Content-Security-Policy con nonce. Función pura: sin next ni Prisma, importable desde tests.
import { ALLOWED_IMAGE_HOSTS } from '../images.ts'

export type CspOptions = {
  /** Nonce por request (base64). */
  nonce: string
  /** Desarrollo: suma 'unsafe-eval' (React lo usa para depuración) y omite upgrade-insecure-requests (también se omite en Report-Only). */
  isDev: boolean
  /** Solo con la política bloqueante: suma upgrade-insecure-requests (el navegador la ignora en Report-Only y avisa por consola). */
  enforce?: boolean
  /** Origen de Supabase para connect-src; solo hace falta si el código de cliente habla con Supabase. */
  supabaseUrl?: string
}

/** Origen (esquema + host) de una URL, o null si no es una URL http(s) válida. */
function originOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

export function buildCsp({ nonce, isDev, enforce = false, supabaseUrl }: CspOptions): string {
  const imageHosts = ALLOWED_IMAGE_HOSTS.map((host) => `https://${host}`)
  const supabaseOrigin = originOf(supabaseUrl)

  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Los style={{}} de React son atributos: los nonces no los cubren.
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: blob: ${imageHosts.join(' ')}`,
    `font-src 'self'`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ]
  if (!isDev && enforce) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}

/** Nombre del encabezado. Para pasar a modo bloqueante, cambiar a 'Content-Security-Policy'. */
export const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only'
