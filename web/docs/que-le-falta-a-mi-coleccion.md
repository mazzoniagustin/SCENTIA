# ¿Qué le falta a tu colección?

Panel de `/mi-coleccion` que compara la colección de la persona con el catálogo, señala qué familias olfativas, estaciones, momentos del día y duraciones casi no tiene y sugiere perfumes del catálogo para cubrirlos. Es 100 % determinista: no depende de ningún modelo. Un cuadro opcional con IA ("Afiná las sugerencias") solo traduce un texto libre a filtros (ADR-010 en `docs/project-specification.md`).

## Qué ve la persona

- Un botón explícito ("¿Qué le falta a tu colección?"): el análisis no corre solo.
- Un titular de plantilla ("Lo que menos exploraste: …"), el detalle por familia y por estación, día/noche, duración y estela, y hasta 5 sugerencias en un rollo que avanza solo, se puede pausar y arrastrar. "Mostrar más" abre el detalle.
- Un selector de género de las sugerencias (masculino, unisex, femenino, todos).
- Estados: sin perfumes (guía), colección chica (se describe, no se habla de huecos), error, sin conexión, sesión vencida y límite de frecuencia (con el tiempo de espera).

## Cómo se calcula

Todo el cálculo vive en `src/lib/gaps/` (módulos puros, con tests) y la lectura de la base en `data.ts`.

**Qué entra.** Solo cuentan los perfumes en estado "Lo tengo" y "Probé una muestra" que tienen acordes (`OWNED`, `SAMPLED`). La lista de deseados y los descartados no cuentan como cobertura. Un acorde cuenta como presente desde intensidad 40 (`ACCORD_PRESENCE_MIN_INTENSITY`). Se leen hasta 500 entradas (`MAX_COLLECTION_ENTRIES`). Nunca se leen las notas privadas ni el puntaje de la persona.

**Familias** (`families.ts`). Diez familias editoriales: cítrico, afrutado, verde, floral, empolvado, dulce, ámbar, amaderado, cuero y acuático. Salen de los grupos de color de los chips de acordes; cada acorde pertenece a una sola familia y los acordes sin familia se ignoran.

**Niveles** (`analyze.ts`, `classifyCoverage`). Para cada familia se compara la presencia en la colección con su frecuencia en el catálogo:
- **Hueco:** familia común del catálogo y ninguno de tus perfumes la tiene.
- **Cobertura débil:** la tenés, pero con mucha menos presencia que en el catálogo (menos de la mitad). Solo con 6 perfumes o más (`WEAK_COVERAGE_MIN_ITEMS`).
- **No explorado:** familia poco frecuente del catálogo (menos del 20 %) que no tenés. Nunca se presenta como hueco ni como logro.
- Con menos de 3 perfumes usables (`MIN_USABLE_ITEMS`) no se habla de huecos.

**Estación, día/noche, duración y estela** (`dimensions.ts`). Mismos niveles. Las estaciones se infieren de los acordes si el perfume no las trae. Día/noche sale de los votos de la comunidad: el catálogo no distingue otras ocasiones (trabajo, fiestas) y la interfaz lo aclara. Cortes de duración (corta < 2,5; larga ≥ 3,5) y de estela (suave < 2; fuerte ≥ 3), elegidos el 2026-10-15 mirando los 41.432 perfumes publicados; son criterios editoriales y revisables (las frecuencias del catálogo se calculan con los mismos cortes). La **estela es solo informativa**: nunca se muestra como carencia ni se busca. Si a más de la mitad de los perfumes usables les falta el dato de una dimensión, esa dimensión no emite huecos (`insufficient_data`).

**Género** (`gender.ts`). Se deduce de la colección: si el 75 % o más es de un género, las sugerencias van de ese género más unisex; si no, todos. La persona lo cambia con el selector. Motivo: el catálogo tiene más del doble de perfumes femeninos y a una colección 100 % masculina le salían perfumes de mujer.

**Sugerencias** (`rank.ts`). Cada hueco pesa 1 y cada cobertura débil 0,5. Para cada candidato del catálogo:
- cobertura = suma del peso de las necesidades que cubre / suma del peso de todas;
- fondo = qué tan a fondo las cubre (en familias: intensidad del acorde y rareza, 30 %);
- puntaje = cobertura × fondo, mezclado con la popularidad (30 %, la misma que usa el quiz).
- Se excluyen lo que ya tiene o probó y lo que descartó, solo ese perfume exacto (sus acordes no se penalizan).
- La lista de deseados puede aparecer con la etiqueta "Ya lo tenés en tu lista de deseados".
- Máximo 5 sugerencias y 2 por marca. Con menos de 3 la lista se marca como corta (`complete: false`).

**Datos del catálogo** (`data.ts`). Las frecuencias del catálogo se calculan con SQL agregado (nunca se traen las 41 mil filas), se cachean 1 hora por proceso y, además, en una caché compartida. Los candidatos salen de un pre-filtro SQL acotado a 80 por necesidad.

## Endpoints

Los dos son `POST`, privados y pasan por los mismos pasos (`guardOutfitRequest`): límite por IP, 415 si no es JSON, 400 si el cuerpo es inválido, 401 sin sesión y 429 por persona (con `Retry-After`).

| Endpoint | Límite | Cuerpo | Notas |
|---|---|---|---|
| `/api/collection/gaps` | 6 por minuto | `{ "gender"?: "masculino" \| "unisex" \| "femenino" \| "todos" }` | Cualquier otro valor da 400. Sin IA. |
| `/api/collection/gaps/refine` | 2 por minuto | `{ "text": string, "gender"?: … }` | Responde 503 si `COLLECTION_LLM_ENABLED` no está activo. |

La respuesta no incluye notas, puntajes, el id de la persona ni ids de su colección; los errores son genéricos. El primer endpoint registra en el log `[api/collection/gaps] status=… catalog=memory|shared|database catalogMs=… totalMs=…` para medir la latencia (sin ids ni colección).

## Afinar con IA (opcional, apagado por defecto)

Se activa con `COLLECTION_LLM_ENABLED=true`; sin la variable el cuadro no aparece. Comparte `GEMINI_API_KEY`, `GEMINI_MODEL` y el enfriamiento del proveedor con las demás funciones con IA (`src/lib/llm/gemini.ts`).

- **Qué recibe el modelo:** solo el texto que la persona escribió (3 a 200 caracteres, sin caracteres de control) y las instrucciones fijas con el vocabulario permitido. Nunca su colección, ids, notas, puntajes, correo, apodo ni ubicación, ni los candidatos ni nombres de perfumes. La interfaz avisa que no se escriban datos personales. Por decisión de la persona propietaria (2026-10-16) ya no menciona que, en el nivel gratuito, Google puede usar el contenido para mejorar sus productos; ese riesgo fue aceptado y sigue vigente.
- **Qué se acepta de vuelta:** un JSON validado contra listas cerradas (`parseRefinement`): hasta 3 familias que quiere y las que evita, hasta 2 estaciones, día/noche, duración, estela, "ocasión" (especial o cotidiano) y el nombre de un perfume de referencia (máx. 60 caracteres, que se resuelve en la base y no se muestra tal cual). Todo valor fuera de la lista se descarta y el texto libre del modelo nunca se muestra.
- **"Ocasión especial"** se aproxima con noche, duración larga y estela fuerte, y la interfaz lo dice.
- **Explicación:** se arma con una plantilla a partir de los filtros ("busqué perfumes nocturnos y de larga duración"), no con texto del modelo.
- **Fallos:** un solo intento con timeout de 8 s. Si la respuesta es inválida, el proveedor falla o está en enfriamiento (60 s), no se afinan las sugerencias y se avisa ("No pudimos interpretar tu pedido ahora…"). Si el texto no produce ningún filtro, se pide contarlo de otra forma.
- **Caché:** 1 hora por texto normalizado, sin identidad.
- **Modelo:** `gemini-3.5-flash` responde en 2–3 s; `gemini-3.5-flash-lite` tarda 6–11 s y puede superar el timeout.

## Decisiones de la persona propietaria

- La lista de deseados no cuenta como cobertura, pero puede aparecer como candidato con etiqueta.
- Los descartados excluyen solo ese perfume. A futuro, penalizar un acorde solo si 3 o más descartados lo comparten.
- "Ocasión" se llama día/noche.
- Estela y "no explorado" nunca se presentan como logro ni como hueco.
- Los textos no comparan con el catálogo ("lo que menos exploraste", no "el 40 % del catálogo tiene…").
- La IA recibe solo agregados anónimos de vocabulario cerrado y está apagada por defecto.
- La frase redactada con IA debajo del titular quedó descartada por ahora: la explicación es de plantilla.

## Accesibilidad y movimiento

- Todo el movimiento (rollo, barras y números) va bajo `prefers-reduced-motion: no-preference`; con movimiento reducido se ve el estado final completo.
- Las animaciones de entrada las dispara un `IntersectionObserver` (`src/app/mi-coleccion/reveal.tsx`, `data-reveal="pending|shown|static"`), así no terminan antes de que alguien las vea.
- Los colores salen de la familia, la estación o el día/noche; la información no depende solo del color.
- `npm run a11y` audita `/mi-coleccion` si se define `A11Y_COOKIE`.

## Pruebas

- Tests puros en `src/lib/gaps/*.test.ts` (más de 90 casos con bordes) y de la interfaz en `view.test.ts`.
- `scripts/gaps-sql.test.ts`: compara el SQL con las funciones puras contra la base real (frecuencias enteras e idénticas).
- `scripts/gaps-preview.ts`: vista previa del análisis para una colección de prueba.
- Smoke: 401, 405, 415, 400 y 429 con `Retry-After` de ambos endpoints.

## Qué falta verificar

- Los dos cuadros con IA contra Gemini real (formato de la API, modelo y cuota; siguen los [CONFIRMAR] de `src/lib/llm/gemini.ts`).
- Latencia en Vercel (excluir una familia, como "sin dulce", es lo más lento: ~5 s en local).
- El 429 por persona, los estados 401/500/red y el lector de pantalla con sesión real, y el toque en un teléfono.
