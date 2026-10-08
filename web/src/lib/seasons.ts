// Inferencia determinista de estaciones a partir de los acordes de un perfume.
// El CSV de Fragrantica no trae `seasons`; esta función las deriva de datos observables.
//
// Cada acorde tiene una afinidad 0-1 con cada estación. Para un perfume:
//   S[estación] = Σ intensidad · afinidad / Σ intensidad          ∈ [0, 1]
// Se devuelve la mejor estación y las que se le acercan (>= RELATIVE_CUTOFF · máximo).
// Si ninguna supera MIN_SCORE no hay señal suficiente y se devuelve [] (sin dato).
//
// Los nombres de acorde deben existir en `Accord.name`; seasons.test.ts lo verifica.
// Si cambian las afinidades, es una inferencia distinta: revisar la distribución antes de reaplicar.

export const SEASONS = ['primavera', 'verano', 'otoño', 'invierno'] as const
export type Season = (typeof SEASONS)[number]

export type SeasonAccord = { name: string; intensity: number }

/** Puntaje mínimo de la mejor estación para considerar que hay señal. */
export const MIN_SCORE = 0.2
/** Una estación secundaria entra si alcanza esta fracción del puntaje de la mejor. */
export const RELATIVE_CUTOFF = 0.85

type Affinity = Readonly<Partial<Record<Season, number>>>

// Acordes frescos y ligeros → verano; florales y verdes → primavera;
// terrosos, especiados y amaderados → otoño; dulces, ambarinos y densos → invierno.
export const ACCORD_SEASONS: Readonly<Record<string, Affinity>> = {
  // Verano
  cítrico: { verano: 1, primavera: 0.4 },
  fresco: { verano: 1, primavera: 0.5 },
  acuático: { verano: 1 },
  marino: { verano: 1 },
  tropical: { verano: 0.9 },
  ozónico: { verano: 0.7, primavera: 0.4 },
  salado: { verano: 0.6 },
  coco: { verano: 0.7 },
  afrutado: { verano: 0.6, primavera: 0.6 },
  'especiado fresco': { verano: 0.4, primavera: 0.3 },
  herbal: { primavera: 0.5, verano: 0.3 },
  // Primavera
  floral: { primavera: 1, verano: 0.3 },
  'floral blanco': { primavera: 0.8, verano: 0.5 },
  'floral amarillo': { primavera: 0.8, verano: 0.5 },
  rosa: { primavera: 0.9 },
  verde: { primavera: 0.9, verano: 0.4 },
  violeta: { primavera: 0.8 },
  iris: { primavera: 0.6, otoño: 0.3 },
  nardo: { primavera: 0.4, verano: 0.5 },
  lavanda: { primavera: 0.4, verano: 0.3, otoño: 0.3 },
  aromático: { primavera: 0.4, otoño: 0.3, verano: 0.3 },
  empolvado: { primavera: 0.5, otoño: 0.4, invierno: 0.2 },
  // Otoño
  amaderado: { otoño: 0.6, invierno: 0.4, primavera: 0.2 },
  terroso: { otoño: 0.9 },
  musgoso: { otoño: 0.8, primavera: 0.2 },
  pachuli: { otoño: 0.8, invierno: 0.4 },
  conífera: { otoño: 0.6, invierno: 0.4 },
  tabaco: { otoño: 0.7, invierno: 0.6 },
  'especiado cálido': { otoño: 0.8, invierno: 0.8 },
  'especiado suave': { otoño: 0.5, invierno: 0.3 },
  canela: { otoño: 0.7, invierno: 0.7 },
  almendra: { otoño: 0.5, invierno: 0.5 },
  'frutos secos': { otoño: 0.6, invierno: 0.5 },
  balsámico: { otoño: 0.6, invierno: 0.8 },
  café: { otoño: 0.6, invierno: 0.7 },
  // Invierno
  ámbar: { invierno: 1, otoño: 0.5 },
  vainilla: { invierno: 1, otoño: 0.4 },
  dulce: { invierno: 0.8, otoño: 0.4 },
  caramelo: { invierno: 0.8, otoño: 0.4 },
  chocolate: { invierno: 0.9, otoño: 0.4 },
  cacao: { invierno: 0.9, otoño: 0.4 },
  miel: { invierno: 0.8, otoño: 0.4 },
  oud: { invierno: 1, otoño: 0.5 },
  cuero: { invierno: 0.8, otoño: 0.6 },
  ahumado: { invierno: 0.8, otoño: 0.5 },
  ron: { invierno: 0.8, otoño: 0.5 },
  whisky: { invierno: 0.8, otoño: 0.5 },
  animalicio: { invierno: 0.6, otoño: 0.5 },
  almizclado: { invierno: 0.3, otoño: 0.3, primavera: 0.3, verano: 0.2 },
  lactónico: { invierno: 0.4, otoño: 0.3 },
}

export function seasonScores(accords: ReadonlyArray<SeasonAccord>): Record<Season, number> {
  const sums: Record<Season, number> = { primavera: 0, verano: 0, otoño: 0, invierno: 0 }
  let total = 0
  for (const { name, intensity } of accords) {
    if (intensity <= 0) continue
    total += intensity
    const affinity = ACCORD_SEASONS[name]
    if (!affinity) continue // acorde sin afinidad estacional: cuenta en el total pero no aporta
    for (const season of SEASONS) sums[season] += intensity * (affinity[season] ?? 0)
  }
  if (total === 0) return sums
  for (const season of SEASONS) sums[season] /= total
  return sums
}

/** Estaciones del perfume, en el orden de SEASONS (estable). [] si no hay señal suficiente. */
export function inferSeasons(accords: ReadonlyArray<SeasonAccord>): Season[] {
  const scores = seasonScores(accords)
  const best = Math.max(...SEASONS.map((s) => scores[s]))
  if (best < MIN_SCORE) return []
  return SEASONS.filter((season) => scores[season] >= best * RELATIVE_CUTOFF)
}
