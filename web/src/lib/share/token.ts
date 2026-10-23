import { createHash, randomBytes } from 'node:crypto'

// 32 bytes de entropía codificados en base64url dan exactamente 43 caracteres.
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Genera un token aleatorio para el link y su hash SHA-256 (el que se guarda en la base). */
export function generateShareToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashShareToken(token) }
}

/** Hash SHA-256 en hex de un token de link. Determinista. */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Valida el formato de un token recibido desde la URL, sin consultar la base. */
export function isValidShareToken(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_PATTERN.test(value)
}
