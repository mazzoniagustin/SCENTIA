// Verificación de los 4 valores de sort contra data real (RF-02).
// Uso: node scripts/check-sort.mjs  (requiere dev server corriendo)

const BASE = 'http://localhost:3000'

async function fetchSorted(query) {
  const response = await fetch(`${BASE}/api/perfumes?${query}`)
  const status = response.status
  const body = await response.json()
  const label = body.data?.map((p) => `${p.brand} | ${p.name} | year:${p.releaseYear ?? 'null'} | dur:${p.duration ?? 'null'}`) ?? JSON.stringify(body)
  return { status, label }
}

const cases = [
  ['', 'RELEVANCE (sin param, default)'],
  ['&sort=relevance', 'RELEVANCE (explícito)'],
  ['&sort=newest', 'NEWEST (releaseYear desc, nulls last)'],
  ['&sort=duration-desc', 'DURATION-DESC'],
  ['&sort=duration-asc', 'DURATION-ASC'],
  ['&sort=popularidad', 'INVÁLIDO (debe dar 400)'],
]

for (const [query, name] of cases) {
  const { status, label } = await fetchSorted(query.replace(/^&/, ''))
  console.log(`\n=== ${name} → HTTP ${status} ===`)
  if (Array.isArray(label)) {
    label.forEach((l) => console.log('  ' + l))
  } else {
    console.log('  ' + label)
  }
}
