// Convierte los slugs de Fragrantica (ej. "victoria-s-secret") en nombres legibles.
// Es determinista: el mismo slug siempre da el mismo resultado, así que el
// upsert por (brand, name) sigue siendo idempotente.

// Marcas cuyo nombre real no se puede deducir del slug (acentos, "&", puntos, siglas).
export const BRAND_EXCEPTIONS: Record<string, string> = {
  'o-boticario': 'O Boticário',
  'lancome': 'Lancôme',
  'estee-lauder': 'Estée Lauder',
  'hermes': 'Hermès',
  'salvador-dali': 'Salvador Dalí',
  'bath-body-works': 'Bath & Body Works',
  'dolce-gabbana': 'Dolce & Gabbana',
  'viktor-rolf': 'Viktor & Rolf',
  'van-cleef-arpels': 'Van Cleef & Arpels',
  'h-m': 'H&M',
  'm-micallef': 'M. Micallef',
  's-t-dupont': 'S.T. Dupont',
  'bond-no-9': 'Bond No. 9',
  'yves-saint-laurent': 'Yves Saint Laurent',
  'lr': 'LR',
  'ds-durga': 'DS & Durga',
  'kkw-fragrance': 'KKW Fragrance',
  'bdk-parfums': 'BDK Parfums',
  'dsh-perfumes': 'DSH Perfumes',
  'haute-fragrance-company-hfc': 'Haute Fragrance Company (HFC)',
  'stephane-humbert-lucas-777': 'Stéphane Humbert Lucas 777',
  'etat-libre-d-orange': "État Libre d'Orange",
  'm-int': 'M.Int',
  'v-canto': 'V Canto',
};

// Partículas que van en minúscula salvo al inicio.
const PARTICLES = new Set(['de', 'di', 'du', 'des', 'del', 'la', 'le', 'the', 'of', 'and', 'by', 'au', 'en']);
// Letras sueltas que forman apóstrofe con la palabra siguiente: l-occitane → L'Occitane.
const ELISION = new Set(['l', 'd']);

// Siglas de concentración que aparecen sueltas en los nombres.
const ACRONYMS = new Set(['edp', 'edt', 'edc']);

const cap =(w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function humanize(slug: string, exceptions: Record<string, string> = {}): string {
  const key = slug.trim();
  if (exceptions[key]) return exceptions[key];

  const words = key.split('-').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = out[out.length - 1];
    if (w === 's' && prev) {
      out[out.length - 1] = `${prev}'s`; // victoria-s-secret → Victoria's
    } else if (ELISION.has(w) && i + 1 < words.length) {
      const head = i === 0 || w === 'l' ? w.toUpperCase() : w; // L'Occitane, D'Orsay, Tesori d'Oriente
      out.push(`${head}'${cap(words[++i])}`);
    } else if (i > 0 && PARTICLES.has(w)) {
      out.push(w);
    } else if (ACRONYMS.has(w)) {
      out.push(w.toUpperCase()); // edp → EDP
    } else {
      out.push(cap(w));
    }
  }
  return out.join(' ');
}

export const humanizeBrand = (slug: string) => humanize(slug, BRAND_EXCEPTIONS);

// Concentración: solo se detecta si el nombre la dice de forma explícita; si no, null.
// Fragrantica casi nunca la incluye (~5,5% de las filas), así que null es lo normal.
export function parseConcentration(nameSlug: string): string | null {
  const s = `-${nameSlug}-`;
  if (/-(eau-de-parfum|edp)-/.test(s)) return 'edp';
  if (/-(eau-de-toilette|edt)-/.test(s)) return 'edt';
  if (/-(eau-de-cologne|edc)-/.test(s)) return 'edc';
  // "parfum" suelto no se usa: suele ser nombre de línea ("Le Parfum"), no concentración.
  if (/-(extrait-de-parfum|extrait)-/.test(s)) return 'parfum';
  return null;
}
