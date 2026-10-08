// Filtro de "me recuerda a" (dataset de Kaggle, CC BY-NC-SA 4.0): votos de la comunidad a favor y en contra. Lógica pura.

export type RawSimilar = { id?: unknown; up_votes?: unknown; down_votes?: unknown }
export type SimilarRow = { similarSourceId: string; upVotes: number; downVotes: number; net: number }

/** Votos mínimos a favor y margen para considerar real un "me recuerda a". */
export const MIN_UP_VOTES = 3
/** Máximo guardado por perfume (el dataset trae hasta 20). */
export const MAX_PER_PERFUME = 20

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0)

/** Normaliza y filtra la lista: sin repetidos ni el propio perfume, con más votos a favor que en contra; ordenada por saldo. */
export function pickSimilar(selfSourceId: string, raw: unknown): SimilarRow[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SimilarRow[] = []
  for (const item of raw as RawSimilar[]) {
    if (typeof item !== 'object' || item === null) continue
    const id = typeof item.id === 'number' || typeof item.id === 'string' ? String(item.id) : ''
    if (!/^\d+$/.test(id) || id === selfSourceId || seen.has(id)) continue
    const upVotes = count(item.up_votes)
    const downVotes = count(item.down_votes)
    if (upVotes < MIN_UP_VOTES || upVotes <= downVotes) continue
    seen.add(id)
    out.push({ similarSourceId: id, upVotes, downVotes, net: upVotes - downVotes })
  }
  return out.sort((a, b) => b.net - a.net || b.upVotes - a.upVotes || a.similarSourceId.localeCompare(b.similarSourceId)).slice(0, MAX_PER_PERFUME)
}
