// Familias olfativas para detectar huecos en la colección. Decisión editorial, sin fuente externa:
// son los grupos de color de los chips (DOT_GROUPS de `cover.ts`) fusionados de 13 a 10, para que la lista
// que ve la persona sea corta. Los nombres son valores de ACCORD_TRANSLATIONS (`Accord.name`, en español y
// minúscula); families.test.ts lo verifica. Un acorde pertenece a una sola familia.
//
// 'pera' y 'cremoso' están por coherencia con `cover.ts`, que los lista. Hoy no existen en la base (la
// importación no los trae), así que no cuentan para nadie. Si algún día aparecen datos con esos acordes, cuentan
// solos: no hace falta tocar este archivo. Los acordes que no están en ninguna familia (sabroso, cannabis,
// alcanfor, plástico, etc., menos de 100 perfumes cada uno) se ignoran: ni familia ni hueco.

export const FAMILY_CODES = [
  'citrico',
  'afrutado',
  'verde',
  'floral',
  'empolvado',
  'dulce',
  'ambar',
  'amaderado',
  'cuero',
  'acuatico',
] as const

export type FamilyCode = (typeof FAMILY_CODES)[number]

/** Orden fijo de presentación y de desempate. */
export const FAMILY_ORDER: readonly FamilyCode[] = FAMILY_CODES

export const FAMILY_LABELS: Readonly<Record<FamilyCode, string>> = {
  citrico: 'Cítrico',
  afrutado: 'Afrutado y tropical',
  verde: 'Verde y aromático',
  floral: 'Floral',
  empolvado: 'Empolvado y almizclado',
  dulce: 'Dulce y gourmand',
  ambar: 'Ámbar y especiado',
  amaderado: 'Amaderado y terroso',
  cuero: 'Cuero y ahumado',
  acuatico: 'Acuático y fresco',
}

export const FAMILY_ACCORDS: Readonly<Record<FamilyCode, readonly string[]>> = {
  citrico: ['cítrico'],
  afrutado: ['afrutado', 'tropical', 'cereza', 'pera', 'coco', 'ácido', 'amargo'],
  verde: ['verde', 'herbal', 'boscoso', 'conífera', 'terpénico', 'musgoso', 'aromático', 'lavanda'],
  floral: ['floral', 'rosa', 'floral amarillo', 'floral blanco', 'violeta', 'iris', 'nardo'],
  empolvado: ['empolvado', 'almizclado', 'jabonoso', 'aldehídico'],
  // Incluye las bebidas alcohólicas (ron, whisky, vino, champán, vodka, sake): decisión de la persona propietaria.
  dulce: [
    'dulce', 'vainilla', 'caramelo', 'miel', 'gourmand', 'chocolate', 'cacao', 'café', 'cremoso', 'lactónico',
    'lácteo', 'almendra', 'frutos secos', 'ron', 'whisky', 'vino', 'champán', 'vodka', 'sake',
  ],
  ambar: ['ámbar', 'oriental', 'balsámico', 'especiado', 'especiado cálido', 'especiado suave', 'especiado fresco', 'canela', 'anís'],
  amaderado: ['amaderado', 'terroso', 'arena', 'arcilla'],
  // 'pachuli': decisión editorial. Coincide con DOT_GROUPS de `cover.ts` (no con FAMILIES, que lo mezcla en un grupo
  // amaderado más grande). Es también terroso: moverlo a 'amaderado' es un cambio de una palabra, y el test de
  // "una sola familia por acorde" cubre que no quede en las dos.
  cuero: ['cuero', 'tabaco', 'oud', 'pachuli', 'ahumado', 'animalicio'],
  acuatico: ['acuático', 'marino', 'ozónico', 'salado', 'fresco', 'mineral', 'metálico'],
}

const FAMILY_BY_ACCORD: ReadonlyMap<string, FamilyCode> = new Map(
  FAMILY_CODES.flatMap((family) => FAMILY_ACCORDS[family].map((name) => [name, family] as const)),
)

/** Familia de un acorde, o null si no pertenece a ninguna (se ignora). */
export function familyOfAccord(name: string): FamilyCode | null {
  return FAMILY_BY_ACCORD.get(name.trim().toLowerCase()) ?? null
}
