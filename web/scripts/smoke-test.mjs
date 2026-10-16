// Prueba de humo de un despliegue (o de la app local). Uso:  npm run smoke -- https://tu-dominio.vercel.app
// Comprueba rutas, cabeceras de seguridad y caché, validaciones, que lo privado exija sesión y, si están las
// variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, que la API REST de Supabase esté cerrada
// por RLS (lectura anónima = 0 filas). No imprime claves y no modifica datos.
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${name}${detail ? `  — ${detail}` : ''}`)
}
const get = (path, init) => fetch(`${BASE}${path}`, { redirect: 'manual', ...init })

console.log(`Prueba de humo contra ${BASE}\n`)

// 1) Vida y base de datos
const health = await get('/api/health')
const healthBody = await health.json().catch(() => ({}))
check('/api/health responde y la base conecta', health.status === 200 && healthBody.db === true, `http ${health.status}`)

// 2) Páginas públicas
for (const [path, marker] of [['/', 'Saltar al contenido'], ['/perfumes', 'Buscar por nombre o marca'], ['/quiz', 'Tu perfil olfativo'], ['/login', 'Correo electrónico'], ['/registro', 'Contraseña'], ['/registro?metodo=enlace', 'Prefiero crear la cuenta con contraseña']]) {
  const r = await get(path)
  const html = await r.text()
  check(`GET ${path}`, r.status === 200 && html.includes(marker), `http ${r.status}`)
}

// 3) Datos reales del catálogo, paginación y caché del CDN
const list = await get('/api/perfumes?pageSize=2')
const listBody = await list.json().catch(() => ({}))
check('catálogo: listado paginado con datos', list.status === 200 && listBody.count === 2 && listBody.total > 1000, `total ${listBody.total}`)
// Vercel reescribe Cache-Control hacia el cliente (quita s-maxage) y expone el estado del CDN en x-vercel-cache;
// en local/otros hosts se ve la cabecera original.
const listCache = list.headers.get('cache-control') ?? ''
const cdnState = list.headers.get('x-vercel-cache')
check(
  'catálogo: cacheable por el CDN',
  /s-maxage=\d+/.test(listCache) || (/public/.test(listCache) && ['HIT', 'MISS', 'STALE', 'PRERENDER'].includes(cdnState ?? '')),
  `${listCache || 'sin cabecera'}${cdnState ? ` · x-vercel-cache: ${cdnState}` : ''}`,
)
const id = listBody.data?.[0]?.id
const ficha = await get(`/perfumes/${id}`)
check('ficha de perfume', ficha.status === 200, `http ${ficha.status}`)
const similares = await get(`/api/perfumes/${id}/recommendations?limit=3`)
const sBody = await similares.json().catch(() => ({}))
check('similares devuelve resultados y no se cachea en común', similares.status === 200 && sBody.count > 0 && /no-store|private/.test(similares.headers.get('cache-control') ?? ''), `${sBody.count} resultados`)
const bad = await get('/api/perfumes?page=0')
check('validación: page inválida → 400 sin detalles internos', bad.status === 400 && !(await bad.text()).includes('Prisma'))
const nf = await get('/perfumes/no-existe')
check('perfume inexistente → 404', nf.status === 404, `http ${nf.status}`)

// 4) Quiz
const answers = { ambiente: 'mar', estacion: 'verano', ocasion: 'deporte', dulzor: 'nada', estilo: 'suave', familias: ['citrico'] }
const quiz = await get('/api/quiz/recommendations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers, limit: 3 }) })
const quizBody = await quiz.json().catch(() => ({}))
check('quiz: recomendaciones', quiz.status === 200 && quizBody.count === 3, `http ${quiz.status}`)
const quizBad = await get('/api/quiz/recommendations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers: {} }) })
check('quiz: respuestas inválidas → 400', quizBad.status === 400)
const daily = await get('/api/perfume-del-dia')
check('perfume del día', daily.status === 200, `http ${daily.status}`)

// 5) Lo privado exige sesión
const account = await get('/account')
check('/account sin sesión redirige a /login', [307, 308].includes(account.status) && (account.headers.get('location') ?? '').includes('/login'), `http ${account.status}`)
const exp = await get('/api/account/export')
const choosePassword = await get('/elegir-contrasena')
check('/elegir-contrasena sin sesión redirige a /login', [307, 308].includes(choosePassword.status) && (choosePassword.headers.get('location') ?? '').includes('/login'), `http ${choosePassword.status}`)
check('exportación de datos sin sesión → 401', exp.status === 401)
const outfitPage = await get('/que-me-pongo')
check('/que-me-pongo sin sesión redirige a /login', [307, 308].includes(outfitPage.status) && (outfitPage.headers.get('location') ?? '').includes('/login'), `http ${outfitPage.status}`)
const jsonPost = (path, body) => get(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const outfitToday = await jsonPost('/api/outfit/today', { latitude: -31.4, longitude: -64.2 })
check('POST /api/outfit/today sin sesión → 401', outfitToday.status === 401, `http ${outfitToday.status}`)
const outfitPlaces = await jsonPost('/api/outfit/places', { query: 'Córdoba' })
check('POST /api/outfit/places sin sesión → 401', outfitPlaces.status === 401, `http ${outfitPlaces.status}`)
const gapsPost = await jsonPost('/api/collection/gaps', {})
check('POST /api/collection/gaps sin sesión → 401', gapsPost.status === 401, `http ${gapsPost.status}`)
const refinePost = await jsonPost('/api/collection/gaps/refine', { text: 'algo fresco' })
check('POST /api/collection/gaps/refine sin sesión → 401', refinePost.status === 401, `http ${refinePost.status}`)
const gapsGet = await get('/api/collection/gaps')
check('GET /api/collection/gaps → 405', gapsGet.status === 405, `http ${gapsGet.status}`)

// 6) Cabeceras de seguridad
const home = await get('/')
for (const header of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) {
  check(`cabecera ${header}`, !!home.headers.get(header))
}
if (BASE.startsWith('https://')) check('cabecera strict-transport-security (https)', !!home.headers.get('strict-transport-security'))
check('sin x-powered-by', !home.headers.get('x-powered-by'))

// 7) RLS visto desde afuera: la API REST de Supabase con la clave pública no debe devolver filas
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (url && key) {
  for (const table of ['User', 'UserCollection', 'UserProfile', 'Perfume']) {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const rows = await r.json().catch(() => null)
    check(`RLS: lectura anónima de ${table} devuelve 0 filas`, Array.isArray(rows) ? rows.length === 0 : r.status >= 400, `http ${r.status}`)
  }
  // Escritura anónima: sin políticas, ni un PATCH (filtro que no coincide con ninguna fila) puede modificar UserProfile
  const patch = await fetch(`${url}/rest/v1/UserProfile?userId=eq.__smoke__`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ nickname: 'smoke-test' }),
  })
  const patched = await patch.json().catch(() => null)
  check('RLS: escritura anónima en UserProfile rechazada o sin filas', Array.isArray(patched) ? patched.length === 0 : patch.status >= 400, `http ${patch.status}`)
} else {
  console.log('(RLS no verificado: definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para incluirlo)')
}

const failed = results.filter((ok) => !ok).length
console.log(`\n${failed === 0 ? 'Todo OK' : `${failed} comprobación(es) fallaron`} (${results.length - failed}/${results.length})`)
process.exitCode = failed === 0 ? 0 : 1
