// Parseo de argumentos del flujo editorial (scripts/editorial.ts). Lógica pura: sin Prisma ni server-only.

export const MAX_IDS_PER_RUN = 500
export const DEFAULT_LIST_LIMIT = 50
export const MAX_LIST_LIMIT = 1000

export type EditorialStatus = 'DRAFT' | 'PUBLISHED'

export type EditorialCommand =
  | { kind: 'list'; status: EditorialStatus | null; limit: number; q: string | null }
  | { kind: 'publish' | 'unpublish'; ids: string[]; file: string | null; apply: boolean; forceLarge: boolean }

export type ParseResult = { ok: true; command: EditorialCommand } | { ok: false; error: string }

const fail = (error: string): ParseResult => ({ ok: false, error })

/** Acepta `draft`/`published` en cualquier caja y devuelve el valor del enum, o null si no es válido. */
export function parseStatus(value: string): EditorialStatus | null {
  const v = value.trim().toLowerCase()
  if (v === 'draft') return 'DRAFT'
  if (v === 'published') return 'PUBLISHED'
  return null
}

/** Convierte `argv` (sin node ni script) en un comando. Opciones con valor: `--k v` o `--k=v`. */
export function parseArgs(argv: string[]): ParseResult {
  const [sub, ...rest] = argv
  if (sub !== 'list' && sub !== 'publish' && sub !== 'unpublish') {
    return fail('Subcomando requerido: list | publish | unpublish')
  }
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const positional: string[] = []
  const withValue = sub === 'list' ? ['--status', '--limit', '--q'] : ['--file']
  const boolean = sub === 'list' ? [] : ['--apply', '--force-large']

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('--')) { positional.push(arg); continue }
    const eq = arg.indexOf('=')
    const name = eq >= 0 ? arg.slice(0, eq) : arg
    if (boolean.includes(name) && eq < 0) { flags.add(name); continue }
    if (!withValue.includes(name)) return fail(`Opción desconocida: ${name}`)
    let value: string | undefined
    if (eq >= 0) value = arg.slice(eq + 1)
    else if (i + 1 < rest.length) value = rest[++i]
    if (value === undefined || value === '') return fail(`La opción ${name} necesita un valor`)
    values.set(name, value)
  }

  if (sub === 'list') {
    if (positional.length) return fail(`Argumento inesperado para list: ${positional[0]}`)
    let status: EditorialStatus | null = null
    if (values.has('--status')) {
      status = parseStatus(values.get('--status')!)
      if (!status) return fail('--status debe ser draft o published')
    }
    let limit = DEFAULT_LIST_LIMIT
    if (values.has('--limit')) {
      const raw = values.get('--limit')!
      const n = /^\d+$/.test(raw) ? Number(raw) : NaN
      if (!Number.isInteger(n) || n < 1 || n > MAX_LIST_LIMIT) return fail(`--limit debe ser un entero entre 1 y ${MAX_LIST_LIMIT}`)
      limit = n
    }
    return { ok: true, command: { kind: 'list', status, limit, q: values.get('--q')?.trim() || null } }
  }

  const file = values.get('--file') ?? null
  if (!positional.length && !file) return fail(`${sub} necesita ids o --file ids.txt`)
  return {
    ok: true,
    command: { kind: sub, ids: positional, file, apply: flags.has('--apply'), forceLarge: flags.has('--force-large') },
  }
}

/** Quita duplicados conservando el orden. */
export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

/** Verifica el tope de ids por corrida; devuelve el mensaje de error o null si está bien. */
export function checkIdLimit(count: number, forceLarge: boolean): string | null {
  if (count > MAX_IDS_PER_RUN && !forceLarge) {
    return `${count} ids superan el tope de ${MAX_IDS_PER_RUN} por corrida; revisá la lista o usá --force-large`
  }
  return null
}
