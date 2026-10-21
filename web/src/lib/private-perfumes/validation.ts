// Validación de lo que llega a las Server Actions de perfumes propios. Las Server Actions son endpoints
// públicos: los tipos de TypeScript no existen en tiempo de ejecución, así que se valida y normaliza todo acá. Lógica pura.

export const GENDERS = ['masculino', 'femenino', 'unisex'] as const

export const NAME_MIN = 2
export const NAME_MAX = 80
export const BRAND_MAX = 80
export const PERFUMER_MAX = 100
export const DESCRIPTION_MAX = 500
export const NOTE_MAX_LENGTH = 40
export const NOTES_MAX_PER_GROUP = 15
export const ACCORDS_MAX = 6
export const LONGEVITY_RANGE = [1, 5] as const
export const SILLAGE_RANGE = [1, 4] as const

export type PrivatePerfumeInput = {
  name: string
  brand: string
  perfumer: string | null
  gender: string
  description: string | null
  topNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
  /** 0 a ACCORDS_MAX ids de acordes existentes, sin repetir. */
  accordIds: string[]
  /** 1-5; se guarda en `Perfume.longevity`. */
  longevity: number | null
  /** 1-4; se guarda en `Perfume.sillage`. */
  sillage: number | null
}

export type PrivatePerfumeValidation = { ok: true; value: PrivatePerfumeInput } | { ok: false; error: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Texto separado por comas → lista sin vacías ni repetidas (sin distinguir mayúsculas), en el orden escrito. */
export function parseNoteList(text: string): string[] {
  return dedupe(text.split(','))
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function optionalText(value: unknown, max: number, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string' || value.trim().length > max) return fail(`${label}: admite hasta ${max} caracteres`)
  return { ok: true, value: value.trim() || null }
}

function noteGroup(value: unknown, label: string): { ok: true; value: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] }
  if (!Array.isArray(value) || value.some((n) => typeof n !== 'string')) return fail(`Las notas de ${label} no son válidas`)
  const notes = dedupe(value as string[])
  if (notes.length > NOTES_MAX_PER_GROUP) return fail(`Las notas de ${label} admiten hasta ${NOTES_MAX_PER_GROUP}`)
  if (notes.some((n) => n.length > NOTE_MAX_LENGTH)) return fail(`Las notas de ${label} admiten hasta ${NOTE_MAX_LENGTH} caracteres cada una`)
  return { ok: true, value: notes }
}

function rangedInteger(value: unknown, [min, max]: readonly [number, number], label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return fail(`${label} debe ser un entero entre ${min} y ${max}`)
  }
  return { ok: true, value }
}

export function validatePrivatePerfume(input: unknown): PrivatePerfumeValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail('datos inválidos')
  const raw = input as Record<string, unknown>

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (name.length < NAME_MIN || name.length > NAME_MAX) return fail(`El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres`)

  const brand = optionalText(raw.brand, BRAND_MAX, 'La marca')
  if (!brand.ok) return brand
  const perfumer = optionalText(raw.perfumer, PERFUMER_MAX, 'El perfumista')
  if (!perfumer.ok) return perfumer
  const description = optionalText(raw.description, DESCRIPTION_MAX, 'La descripción')
  if (!description.ok) return description

  let gender = 'unisex'
  if (raw.gender !== undefined && raw.gender !== null && raw.gender !== '') {
    if (!(GENDERS as readonly unknown[]).includes(raw.gender)) return fail(`El género debe ser uno de: ${GENDERS.join(', ')}`)
    gender = raw.gender as string
  }

  const topNotes = noteGroup(raw.topNotes, 'salida')
  if (!topNotes.ok) return topNotes
  const heartNotes = noteGroup(raw.heartNotes, 'corazón')
  if (!heartNotes.ok) return heartNotes
  const baseNotes = noteGroup(raw.baseNotes, 'fondo')
  if (!baseNotes.ok) return baseNotes

  let accordIds: string[] = []
  if (raw.accordIds !== undefined && raw.accordIds !== null) {
    if (!Array.isArray(raw.accordIds) || raw.accordIds.some((id) => typeof id !== 'string' || !id || id.length > 64)) {
      return fail('Los acordes no son válidos')
    }
    accordIds = [...new Set(raw.accordIds as string[])]
    if (accordIds.length > ACCORDS_MAX) return fail(`Podés elegir hasta ${ACCORDS_MAX} acordes`)
  }

  const longevity = rangedInteger(raw.longevity, LONGEVITY_RANGE, 'La duración')
  if (!longevity.ok) return longevity
  const sillage = rangedInteger(raw.sillage, SILLAGE_RANGE, 'La estela')
  if (!sillage.ok) return sillage

  return {
    ok: true,
    value: {
      name,
      brand: brand.value ?? '',
      perfumer: perfumer.value,
      gender,
      description: description.value,
      topNotes: topNotes.value,
      heartNotes: heartNotes.value,
      baseNotes: baseNotes.value,
      accordIds,
      longevity: longevity.value,
      sillage: sillage.value,
    },
  }
}

/** Campos del formulario como entrada cruda: los tipos y rangos los valida `validatePrivatePerfume`. */
export function privatePerfumeInputFromFormData(formData: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = formData.get(name)
    return typeof value === 'string' ? value : undefined
  }
  const number = (name: string) => {
    const value = text(name)?.trim()
    // Vacío = sin dato; un valor no numérico llega como NaN y la validación lo rechaza con un mensaje claro.
    return value ? Number(value) : undefined
  }
  const notes = (name: string) => parseNoteList(text(name) ?? '')
  return {
    name: text('name'),
    brand: text('brand'),
    perfumer: text('perfumer'),
    gender: text('gender'),
    description: text('description'),
    topNotes: notes('topNotes'),
    heartNotes: notes('heartNotes'),
    baseNotes: notes('baseNotes'),
    accordIds: formData.getAll('accordIds').filter((id): id is string => typeof id === 'string'),
    longevity: number('longevity'),
    sillage: number('sillage'),
  }
}
