export type PerfumeNote = {
  noteType: string;
  note: { name: string };
};

export type PerfumeAccord = {
  intensity: number;
  accord: { name: string };
};

export type Perfume = {
  id: string;
  brand: string;
  name: string;
  gender: string;
  concentration: string | null;
  releaseYear?: number | null;
  perfumer?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  duration?: number | null;
  projection?: number | null;
  seasons: string[];
  occasions: string[];
  priceTier?: 'ARABIC' | 'DESIGNER' | 'NICHE' | null;
  notes?: PerfumeNote[];
  accords?: PerfumeAccord[];
};

export const PRICE_TIER_LABELS = {
  ARABIC: "Árabe",
  DESIGNER: "Diseñador",
  NICHE: "Nicho",
} as const;

export const NO_DATA = "Sin dato";

export function valueOrNoData<T>(value: T | null | undefined, format: (v: T) => string): string {
  return value === null || value === undefined ? NO_DATA : format(value);
}

// Como en Fragrantica ("for women / for men"): el mismo nombre existe a veces en versiones distintas.
const GENDER_LABELS: Record<string, string> = { femenino: "Para mujeres", masculino: "Para hombres", unisex: "Unisex" };

export function genderLabel(gender: string): string {
  return GENDER_LABELS[gender] ?? gender;
}
