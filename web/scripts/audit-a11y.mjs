// Auditoría de accesibilidad con axe-core sobre el HTML real de cada página (renderizado por el servidor),
// ejecutado en jsdom. Uso (con la app corriendo):  npm run a11y [-- http://localhost:3000]
// Cobertura: reglas WCAG 2.0/2.1 A y AA y buenas prácticas de axe sobre estructura, nombres, etiquetas, ARIA,
// encabezados y landmarks. NO cubre: contraste de color (jsdom no tiene layout; se calcula aparte, ver
// docs/accesibilidad.md), foco visible, ni /account (requiere sesión y no está en la lista), ni lectores de pantalla reales.
import { JSDOM } from 'jsdom'
import axe from 'axe-core'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

// Opcional: cookie de una sesión de prueba (ej. A11Y_COOKIE="sb-...-auth-token=...") para auditar /que-me-pongo y /mi-coleccion.
const A11Y_COOKIE = process.env.A11Y_COOKIE ?? ''

const getJson =async (path) => (await fetch(`${BASE}${path}`)).json()

async function pages() {
  const { data } = await getJson('/api/perfumes?pageSize=3')
  const ids = data.map((p) => p.id)
  const quiz = 'ambiente=mar&estacion=verano&ocasion=deporte&dulzor=nada&estilo=suave&familias=citrico&evitar=oud'
  return [
    ['Portada', '/'],
    ['Ingresar', '/login'],
    ['Registro', '/registro'],
    ['Login enviado', '/login?sent=1'],
    ['Registro enviado', '/registro?sent=1'],
    ['Registro por enlace', '/registro?metodo=enlace'],
    ['Registro con error de contraseña', '/registro?error=password-short'],
    ['Ingreso con error', '/login?error=credentials'],
    ['Registro con error', '/registro?error=nickname-taken&nickname=luna'],
    ['Marcas', '/marcas'],
    ['Marca', '/marcas/Armaf'],
    ['Créditos', '/creditos'],
    ['Quiz', '/quiz'],
    ['Resultado del quiz', `/quiz/resultado?${quiz}`],
    ['Catálogo', '/perfumes'],
    ['Catálogo con filtros', '/perfumes?q=black&accord=oud&season=invierno'],
    ['Ficha de perfume', `/perfumes/${ids[0]}`],
    ['Comparador', `/perfumes/compare?ids=${ids.join(',')}`],
    ['Perfume inexistente (404)', '/perfumes/no-existe'],
    ...(A11Y_COOKIE ? [['¿Qué me pongo hoy? (con sesión)', '/que-me-pongo'], ['Mi colección (con sesión)', '/mi-coleccion'], ['Agregar perfume propio (con sesión)', '/mi-coleccion/nuevo'], ['Elegir contraseña (con sesión sin contraseña)', '/elegir-contrasena']] : []),
  ]
}

async function audit(name, path) {
  // Las páginas privadas se auditan solo si se pasa una cookie de sesión (A11Y_COOKIE); si no, se omiten.
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual', headers: A11Y_COOKIE ? { cookie: A11Y_COOKIE } : {} })
  const html = await response.text()
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: `${BASE}${path}` })
  dom.window.eval(axe.source)
  // Next sirve el 404 de notFound() como un "shell de error" (<html id="__next_error__">) y el navegador completa el
  // documento al hidratar: el idioma (lang="es"), el contenido y el enlace de salto viajan en el payload RSC de la
  // respuesta (verificado). Auditar solo el HTML inicial daría un falso positivo en html-has-lang, que se excluye
  // únicamente para ese shell y se informa en pantalla.
  const errorShell = html.includes('id="__next_error__"')
  const rules = { 'color-contrast': { enabled: false }, ...(errorShell ? { 'html-has-lang': { enabled: false } } : {}) }
  const results = await dom.window.axe.run(dom.window.document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules,
  })
  dom.window.close()
  return { name, path, status: response.status, violations: results.violations, passes: results.passes.length, errorShell }
}

const list = await pages()
let total = 0
for (const [name, path] of list) {
  const r = await audit(name, path)
  total += r.violations.length
  console.log(`\n${r.violations.length === 0 ? 'OK   ' : 'FALLA '} ${name}  [${r.status}] ${path.slice(0, 70)}  (${r.passes} reglas cumplidas, ${r.violations.length} incumplidas)`)
  if (r.errorShell) console.log('   (shell de error de Next: html-has-lang excluida; el lang llega en el payload y se aplica al hidratar)')
  for (const v of r.violations) {
    console.log(`   - [${v.impact}] ${v.id}: ${v.help}  (${v.nodes.length} elemento/s)`)
    for (const n of v.nodes.slice(0, 2)) console.log(`       ${n.html.replace(/\s+/g, ' ').slice(0, 130)}`)
  }
}
console.log(`\nResumen: ${total} incumplimiento(s) en ${list.length} páginas`)
process.exitCode = total === 0 ? 0 : 1
