// Portada generada para los perfumes sin imagen: un tinte según el acorde dominante.
// Sin dependencias de terceros ni imágenes: se reemplaza por la foto real cuando exista (`imageUrl`).

type Accord = { intensity: number; accord: { name: string } };

// Familias olfativas → tono (0-360). Los acordes sin familia conocida caen en un tono neutro.
const FAMILIES: Array<{ hue: number; words: string[] }> = [
  { hue: 210, words: ["acuático", "marino", "ozónico", "salado", "mineral", "metálico", "fresco"] },
  { hue: 150, words: ["verde", "herbal", "aromático", "conífera", "lavanda", "musgoso", "terroso", "terpénico"] },
  { hue: 95, words: ["cítrico", "tropical", "afrutado", "cereza", "coco", "ácido", "amargo"] },
  { hue: 340, words: ["floral", "rosa", "floral blanco", "floral amarillo", "violeta", "iris", "nardo", "empolvado", "jabonoso"] },
  { hue: 30, words: ["dulce", "vainilla", "caramelo", "miel", "gourmand", "chocolate", "cacao", "café", "cremoso", "lactónico", "almendra", "frutos secos", "ron", "whisky", "vino", "champán", "vodka"] },
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
