# Accesibilidad: plan de pruebas, resultados y checklist — 2026-10-08

## Qué se probó y cómo

| Nivel | Qué | Cómo | Resultado |
|---|---|---|---|
| Automático | Estructura, nombres, etiquetas, ARIA, encabezados, landmarks, idioma, ids repetidos | `npm run a11y` (axe-core 4.13 sobre el HTML real de 9 páginas, en jsdom) contra el servidor de producción | **0 incumplimientos** (antes de corregir: 3) |
| Cálculo | Contraste de color del tema | Fórmula WCAG sobre los colores de `globals.css` | Todo el texto cumple (6,4:1 a 15,5:1); bordes de campos corregidos a ≥ 3:1 |
| Revisión de código | Teclado, foco, semántica, mensajes de error, movimiento | Lectura de los componentes y estilos | Ver "Correcciones" |
| **Manual** | Teclado real, lector de pantalla, zoom, páginas con sesión | **Pendiente: lo hace una persona** (checklist abajo) | — |

Páginas auditadas: portada, ingresar, quiz, resultado del quiz, catálogo (con y sin filtros), ficha, comparador y 404.

## Correcciones hechas

| Problema | Criterio WCAG | Corrección |
|---|---|---|
| 6 selectores del catálogo sin nombre accesible (axe: crítico) | 4.1.2 Nombre, función, valor | `aria-label` en cada selector y campo; también en el formulario de colección |
| Sin enlace para saltar al contenido | 2.4.1 Evitar bloques | "Saltar al contenido" (visible al enfocar) y `id="contenido"` en el `<main>` de cada página |
| Foco visible solo en algunos elementos | 2.4.7 Foco visible | `:focus-visible` global de 3 px |
| Bordes de campos con 1,3:1 | 1.4.11 Contraste no textual | `--control-border` (4,2:1 sobre blanco, 4,0:1 sobre el fondo) en campos, selectores y áreas de texto |
| Títulos de página genéricos ("Perfumes") | 2.4.2 Título de página | Plantilla "<página> — Perfumes" en catálogo, comparador, ingresar, mi colección, cuenta, quiz y ficha |
| 404 en inglés y sin estructura propia | 3.1.1 Idioma de la página | `not-found.tsx` en español dentro del layout (`lang="es"`) |
| Notas olfativas en inglés dentro de páginas en español | 3.1.2 Idioma de las partes | `lang="en"` en las notas de la ficha y del comparador |
| Opciones del formulario de colección en inglés ("Owned", "Disliked") | 3.1.1 | Etiquetas en español (los valores internos no cambian) |
| Sin respeto a "reducir movimiento" | 2.3.3 (AAA, buena práctica) | `prefers-reduced-motion` |

### Lo que ya estaba bien
`<html lang="es">`; un `h1` por página y jerarquía de encabezados; controles nativos (`a`, `button`, `input`, `select`) sin widgets
personalizados; etiquetas enlazadas en el formulario de ingreso; `fieldset`/`legend` en el quiz; mensajes de error con `role="alert"` y de
estado con `role="status"`; paginación en `nav` con nombre; el radar del comparador tiene `role="img"` con título y descripción y una
**tabla equivalente** debajo, así que la información no depende solo del color; objetivos táctiles de al menos 2,75 rem.

## Limitaciones de esta evidencia (qué NO cubre)
- axe en jsdom **no calcula contraste** (no hay motor de diseño): se calculó aparte con la fórmula, pero no sobre el renderizado real
  (estados hover/foco, texto sobre imágenes — no hay imágenes).
- **No se probó con lectores de pantalla** ni con teclado real. Que axe no encuentre fallas no demuestra que la experiencia sea buena.
- **Páginas con sesión** (`/account`, `/mi-coleccion` y el formulario de colección autenticado) no entran en la auditoría automática.
- La 404 de `notFound()` se sirve como el "shell de error" de Next y se completa al hidratar (el `lang` y el contenido viajan en el payload
  de la respuesta). La auditoría excluye `html-has-lang` solo para ese documento y lo informa; sin JavaScript esa 404 no muestra contenido.
- No se midió reflow a 320 px ni zoom al 200 % (revisión manual).

## Checklist manual (≈ 15 minutos, antes de lanzar)
Con la app corriendo, en este orden:
- [ ] **Teclado**: recorrer portada, catálogo, ficha y quiz solo con Tab / Shift+Tab / Enter / Espacio / flechas. ¿Se ve siempre dónde está el foco? ¿El primer Tab muestra "Saltar al contenido" y funciona?
- [ ] **Quiz**: responder solo con teclado (flechas en las opciones únicas, Espacio en las múltiples) y enviar.
- [ ] **Catálogo**: filtrar, paginar y abrir una ficha sin mouse. Marcar dos perfumes para comparar con Espacio.
- [ ] **Zoom 200 %** y ventana de 320 px de ancho: ¿hay scroll horizontal o contenido cortado? (se espera solo en tablas anchas, dentro de su contenedor).
- [ ] **Lector de pantalla** (NVDA en Windows o VoiceOver en Mac) en catálogo, ficha y quiz: ¿se anuncian los selectores con su nombre? ¿El radar describe algo útil y la tabla repite los datos?
- [ ] **Con sesión**: `/account` (preferencias, eliminar cuenta) y `/mi-coleccion`: formularios con nombre, errores anunciados.
- [ ] **Modo de alto contraste / forzar colores** del sistema: los bordes y el foco siguen visibles.

## Cómo repetirlo
`npm run build && npm start` (o `npm run dev`) y en otra terminal `npm run a11y` (acepta una URL: `npm run a11y -- https://tu-dominio`).
Sale con código 1 si hay incumplimientos, así que sirve como puerta en un flujo de integración continua.
