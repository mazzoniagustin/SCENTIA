// Valores y etiquetas de los filtros del catálogo, compartidos por el formulario, los chips y la API.
// Módulo puro (sin Prisma) para poder usarlo desde componentes y desde tests.

export const GENDERS = ['femenino', 'masculino', 'unisex'] as const
export const SEASONS = ['primavera', 'verano', 'otoño', 'invierno'] as const

export const GENDER_LABELS: Record<string, string> = {
  femenino: 'Para mujeres',
  masculino: 'Para hombres',
  unisex: 'Unisex',
}

export const SEASON_LABELS: Record<string, string> = {
  primavera: 'Primavera',
  verano: 'Verano',
  otoño: 'Otoño',
  invierno: 'Invierno',
}

// Alias aceptados (en minúsculas) para el género; en la base se guarda en español.
const GENDER_ALIASES: Record<string, (typeof GENDERS)[number]> = {
  men: 'masculino',
  male: 'masculino',
  hombre: 'masculino',
  hombres: 'masculino',
  masculino: 'masculino',
  women: 'femenino',
  female: 'femenino',
  mujer: 'femenino',
  mujeres: 'femenino',
  femenino: 'femenino',
  unisex: 'unisex',
}

/** Devuelve el género canónico para un alias (insensible a mayúsculas); null si no lo conoce. */
export function normalizeGender(value: string | null | undefined): (typeof GENDERS)[number] | null {
  if (!value) return null
  return GENDER_ALIASES[value.trim().toLowerCase()] ?? null
}

/** Devuelve la estación canónica (insensible a mayúsculas); null si no la conoce. */
export function normalizeSeason(value: string | null | undefined): (typeof SEASONS)[number] | null {
  const season = value?.trim().toLowerCase()
  return SEASONS.find((s) => s === season) ?? null
}
