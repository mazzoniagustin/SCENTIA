// Portada generada para los perfumes sin imagen: un tinte según el acorde dominante.
// Sin dependencias de terceros ni imágenes: se reemplaza por la foto real cuando exista (`imageUrl`).

type Accord = { intensity: number; accord: { name: string } };

// Familias olfativas → tono (0-360). Los acordes sin familia conocida caen en un tono neutro.
const FAMILIES: Array<{ hue: number; words: string[] }> = [
  { hue: 210, words: ["acuático", "marino", "ozónico", "salado", "mineral", "metálico", "fresco"] },
  { hue: 150, words: ["verde", "boscoso", "herbal", "aromático", "conífera", "lavanda", "musgoso", "terroso", "terpénico"] },
  { hue: 95, words: ["cítrico", "tropical", "afrutado", "pera", "cereza", "coco", "ácido", "amargo"] },
  { hue: 340, words: ["floral", "rosa", "floral blanco", "floral amarillo", "violeta", "iris", "nardo", "empolvado", "jabonoso"] },
  { hue: 30, words: ["dulce", "vainilla", "caramelo", "miel", "gourmand", "chocolate", "cacao", "café", "cremoso", "lactónico", "lácteo", "almendra", "frutos secos", "ron", "whisky", "vino", "champán", "vodka"] },
  { hue: 18, words: ["especiado", "especiado cálido", "especiado suave", "especiado fresco", "canela", "anís", "ámbar", "oriental", "balsámico"] },
  { hue: 38, words: ["amaderado", "cuero", "tabaco", "oud", "pachuli", "ahumado", "animalicio", "almizclado", "arena", "arcilla"] },
];

const NEUTRAL_HUE = 40;

export function hueForAccord(name: string): { hue: number; known: boolean } {
  const key = name.trim().toLowerCase();
  for (const family of FAMILIES) {
    if (family.words.includes(key)) return { hue: family.hue, known: true };
  }
  return { hue: NEUTRAL_HUE, known: false };
}

export function dominantAccord(accords: Accord[] | undefined): string | null {
  if (!accords || accords.length === 0) return null;
  // Desempate estable: mayor intensidad, y a igualdad el nombre.
  const sorted = [...accords].sort(
    (a, b) => b.intensity - a.intensity || a.accord.name.localeCompare(b.accord.name),
  );
  return sorted[0].accord.name;
}

// Fondo oscuro (L 16 %) y texto claro (L 78 %): el contraste es siempre > 7:1 sea cual sea el tono.
export function coverColors(accords: Accord[] | undefined): { background: string; color: string; accord: string | null } {
  const accord = dominantAccord(accords);
  const { hue, known } = accord ? hueForAccord(accord) : { hue: NEUTRAL_HUE, known: false };
  const saturation = known ? 30 : 6;
  return {
    background: `hsl(${hue} ${saturation}% 16%)`,
    color: `hsl(${hue} ${known ? 45 : 8}% 78%)`,
    accord,
  };
}

// Monograma: primera letra de las dos primeras palabras significativas (se saltan conectores: "Bleu de Chanel" → "BC").
const CONNECTORS = new Set(["de", "del", "la", "le", "les", "el", "los", "y", "and", "of", "the", "in", "by", "no", "for"]);

export function initialsOf(name: string): string {
  const words = name
    .split(/[\s'’\-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  // Solo palabras que empiezan con letra (los números como "18" o "2020" no dan iniciales) y sin conectores.
  const letters = words.filter((w) => /^\p{L}/u.test(w));
  const significant = letters.filter((w) => !CONNECTORS.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : letters.length > 0 ? letters : words;
  return pool
    .slice(0, 2)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join("");
}

// Color del punto de cada acorde en los chips. Más fino que las familias de la portada: cítrico, afrutado y aromático ya no
// comparten verde. Decorativo: el nombre del acorde siempre está en el texto.
const DOT_GROUPS: Array<{ color: string; words: string[] }> = [
  { color: '#e4d34a', words: ['cítrico'] },
  { color: '#f0825a', words: ['afrutado', 'tropical', 'cereza', 'pera', 'coco', 'ácido', 'amargo'] },
  { color: '#5dbb78', words: ['verde', 'herbal', 'boscoso', 'conífera', 'terpénico', 'musgoso'] },
  { color: '#8a84e6', words: ['aromático', 'lavanda'] },
  { color: '#e879a8', words: ['floral', 'rosa', 'floral amarillo', 'violeta', 'iris', 'nardo'] },
  { color: '#f2d0e0', words: ['floral blanco'] },
  { color: '#b6a6c9', words: ['empolvado', 'almizclado', 'jabonoso', 'aldehídico'] },
  { color: '#d49b63', words: ['dulce', 'vainilla', 'caramelo', 'miel', 'gourmand', 'chocolate', 'cacao', 'café', 'cremoso', 'lactónico', 'lácteo', 'almendra', 'frutos secos', 'ron', 'whisky', 'vino', 'champán', 'vodka', 'sake'] },
  { color: '#d9822b', words: ['ámbar', 'oriental', 'balsámico'] },
  { color: '#c9503c', words: ['especiado', 'especiado cálido', 'especiado suave', 'especiado fresco', 'canela', 'anís'] },
  { color: '#9a7552', words: ['amaderado', 'terroso', 'arena', 'arcilla'] },
  { color: '#7d6a5a', words: ['cuero', 'tabaco', 'oud', 'pachuli', 'ahumado', 'animalicio'] },
  { color: '#4aa5d6', words: ['acuático', 'marino', 'ozónico', 'salado', 'fresco', 'mineral', 'metálico'] },
]

export const NEUTRAL_DOT_COLOR = '#8a867f'

export function accordDotColor(name: string): string {
  const key = name.trim().toLowerCase()
  return DOT_GROUPS.find((g) => g.words.includes(key))?.color ?? NEUTRAL_DOT_COLOR
}
