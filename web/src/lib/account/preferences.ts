// Preferencias de idioma, país y moneda (RF-08). Son datos configurables; el lanzamiento usa español
// y no convierte precios. Validación pura para poder probarla sin base de datos.

export const LOCALES = ['es', 'en'] as const

export type Preferences = {
  locale: string
  country: string | null
  currency: string | null
}

export type PreferencesResult = { ok: true; value: Preferences } | { ok: false; error: string }

const nullable = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.toUpperCase()
}

/** locale: uno de LOCALES; country: código ISO de 2 letras; currency: código ISO de 3 letras. Vacío = sin dato. */
export function validatePreferences(input: unknown): PreferencesResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'preferencias inválidas' }
  }
  const raw = input as Record<string, unknown>

  const locale = typeof raw.locale === 'string' ? raw.locale.trim().toLowerCase() : 'es'
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return { ok: false, error: `locale debe ser uno de: ${LOCALES.join(', ')}` }
  }

  const country = nullable(raw.country)
  if (country === undefined || (country !== null && !/^[A-Z]{2}$/.test(country))) {
    return { ok: false, error: 'country debe ser un código de 2 letras (ej. AR)' }
  }

  const currency = nullable(raw.currency)
  if (currency === undefined || (currency !== null && !/^[A-Z]{3}$/.test(currency))) {
    return { ok: false, error: 'currency debe ser un código de 3 letras (ej. ARS)' }
  }

  return { ok: true, value: { locale, country, currency } }
}
