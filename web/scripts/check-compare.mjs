// Verificación del param ids del comparador contra data real (RF-03).
// Uso: node scripts/check-compare.mjs  (requiere dev server corriendo)
//
// Contract verificado:
//   - 2-4 ids válidos → 200, data en el ORDEN del param (sort se ignora)
//   - <2 o >4 ids → 400; duplicados → 400
//   - id inexistente → 200 con los existentes + missing:[id]
//   - sin ids → respuesta idéntica a la del catálogo (sin campo missing)

const BASE = 'http://localhost:3000'

async function fetchIds(query) {
  const response = await fetch(`${BASE}/api/perfumes${query}`)
  const status = response.status
  const body = await response.json()
  return { status, body }
}

const results = []

function check(name, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL'
  results.push({ name, mark, detail })
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

// Los 3 primeros ids reales del seed + un id inexistente para el caso missing
const SEED_IDS = ['p1', 'p2', 'p3', 'p4']

async function main() {
  // 1. Orden del param: pedir p3,p1 y verificar que data vuelve en ese orden
  {
    const { status, body } = await fetchIds('?ids=p3,p1')
    const order = body.data?.map((p) => p.id).join(',')
    check(
      'orden del param preservado (p3,p1)',
      status === 200 && order === 'p3,p1',
      `HTTP ${status}, order ${order}`,
    )
  }

  // 1b. sort se ignora cuando hay ids
  {
    const { status, body } = await fetchIds('?ids=p3,p1&sort=newest')
    const order = body.data?.map((p) => p.id).join(',')
    check(
      'sort ignorado con ids (p3,p1 + sort=newest)',
      status === 200 && order === 'p3,p1',
      `HTTP ${status}, order ${order}`,
    )
  }

  // 2. Un solo id → 400
  {
    const { status, body } = await fetchIds('?ids=p1')
    check('un id → 400', status === 400 && typeof body.error === 'string', `HTTP ${status}, ${body.error}`)
  }

  // 3. Id inexistente → 200 + missing
  {
    const { status, body } = await fetchIds('?ids=p1,p99')
    const missingOk = JSON.stringify(body.missing) === JSON.stringify(['p99'])
    check(
      'id inexistente → 200 + missing:["p99"]',
      status === 200 && body.data?.length === 1 && missingOk,
      `HTTP ${status}, count ${body.data?.length}, missing ${JSON.stringify(body.missing)}`,
    )
  }

  // 4. Duplicados → 400
  {
    const { status, body } = await fetchIds(`?ids=${SEED_IDS[0]},${SEED_IDS[0]}`)
    check('duplicados → 400', status === 400 && typeof body.error === 'string', `HTTP ${status}, ${body.error}`)
  }

  // 5. Más de 4 → 400
  {
    const { status, body } = await fetchIds('?ids=p1,p2,p3,p4,p5')
    check('5 ids → 400', status === 400 && typeof body.error === 'string', `HTTP ${status}, ${body.error}`)
  }

  // 6. Sin ids → comportamiento del catálogo (sin campo missing)
  {
    const { status, body } = await fetchIds('')
    check(
      'sin ids → catálogo normal, sin campo missing',
      status === 200 && !('missing' in body) && Array.isArray(body.data),
      `HTTP ${status}, count ${body.data?.length}, missing ${JSON.stringify(body.missing)}`,
    )
  }

  // 7. 4 ids (máximo) → 200
  {
    const { status, body } = await fetchIds(`?ids=${SEED_IDS.join(',')}`)
    check(
      '4 ids (máximo) → 200 en orden',
      status === 200 && body.data?.map((p) => p.id).join(',') === SEED_IDS.join(','),
      `HTTP ${status}, order ${body.data?.map((p) => p.id).join(',')}`,
    )
  }

  const failed = results.filter((r) => r.mark === 'FAIL').length
  console.log(`\n${results.length - failed}/${results.length} checks pasaron`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('No se pudo ejecutar la verificación:', error.message)
  process.exit(1)
})
