# Diseño: quiz de perfil olfativo

Estado (2026-10-08): **implementado** — fases 1 a 4 hechas (librería, endpoint, UI y persistencia del perfil con sesión); queda
la integración de `UserProfile` en la exportación/eliminación de cuenta, que ya está resuelta en `src/lib/account/data.ts`.
Cambios respecto del diseño original: se mezcla la **popularidad** (cantidad de valoraciones, peso 0,3) con el puntaje para que el top
no sea siempre de casas poco conocidas, y `UserProfile` incluye además idioma, país y moneda (RF-08). Relacionado con RF-07.

## Versión 2 (2026-10-17): duración, estela y perfumes que ya amás
`QUIZ_VERSION = 2`. Los perfiles guardados con la versión 1 siguen valiendo (`QUIZ_COMPATIBLE_FROM = 1`): las preguntas nuevas toman su
opción por defecto ("Me da igual"). Los enlaces viejos de `/quiz/resultado` también.
- **Duración** (`larga` = "Que dure todo el día", `ligera` = "Algo liviano, aunque dure menos") y **estela** (`discreta`, `notoria`): preguntas
  opcionales de una opción (`defaultOptionId: 'cualquiera'`). No suman acordes: son preferencias.
- **Estación y ocasión** dejan de ser solo acordes: también son preferencias (verano, invierno, primavera u otoño; día o noche).
- **Preferencias** (`src/lib/quiz/preferences.ts`): ajuste **suave**, nunca filtro. Por cada preferencia activa, el perfume coincide (1), no coincide (0) o
  no tiene el dato (0,5, neutral). `puntaje × (1 − 0,25 + 0,25 × promedio)`: lo máximo que se pierde es el 25 %, y sin preferencias activas el puntaje no cambia.
  Cortes de duración y estela: los del módulo de huecos (`durationBand`, `sillageBand`). "Liviano" coincide con duración corta o media; "discreto" solo con estela suave.
- **Perfumes que ya amás** (opcional, hasta 3, `favoritos` = ids del catálogo): un buscador (`FavoritesPicker`, usa `GET /api/perfumes?q=`) en el último paso.
  Sus acordes se suman al perfil (`addFavorites`: 50 % de la intensidad, acotado a 100, sin acordes rechazados) y esos perfumes no se recomiendan.
  Un id inexistente o no publicado se ignora. Sin JavaScript el paso se oculta y el quiz funciona igual.
- **Resultados:** si un perfume cumple preferencias, la tarjeta dice "Coincide con lo que pediste: …". El resumen suma "Perfumes que amás".
- **Sin presupuesto:** `priceTier` está vacío en el catálogo (3 de 41.432); la pregunta queda pendiente de importar `country` y definir la lista de marcas.
- Tests: `src/lib/quiz/quiz-v2.test.ts` (compatibilidad con v1, validación de favoritos, `addFavorites`, preferencias y ranking).

## Decisiones tomadas
- **Persistencia**: el perfil se guarda solo si hay sesión. Anónimos usan el quiz sin guardar nada.
- **Sesgo hacia acordes comunes**: se corrige con ponderación por rareza (IDF).
- **Longitud**: 6 preguntas + una de rechazos (~2 min).

## Restricciones
- Determinista, explicable y sin IA (RF-07, ADR-007). Cada resultado muestra razones basadas en datos observables.
- Los datos personales (el perfil guardado) entran en la exportación y eliminación de cuenta (RF-05).
- Autorización a nivel de aplicación: el perfil se lee/escribe siempre por el usuario de la sesión del servidor, nunca por un id del cliente.

## Modelo
El perfil es un vector `P` de pesos 0-100 sobre acordes (misma escala que `PerfumeAccord.intensity`).
Cada respuesta suma pesos a varios acordes; el resultado se acota a 100. Más una lista `avoid` de acordes rechazados.

Las preguntas y sus pesos viven en código (`src/lib/quiz/questions.ts`), versionadas con un número `QUIZ_VERSION`, no en la DB.
Los nombres de acordes deben existir en `Accord` (84 términos en español); un test lo verifica.

| # | Pregunta | Tipo | Ejemplo de mapeo (acorde → peso) |
|---|---|---|---|
| 1 | Ambiente que te atrae | una opción | Bosque tras la lluvia → terroso 60, musgoso 50, verde 50, amaderado 40 · Mar → marino 70, acuático 60, salado 40, cítrico 30 · Jardín → floral 60, floral blanco 50, rosa 40 · Postre → dulce 60, vainilla 60, caramelo 40 · Noche en la ciudad → ámbar 50, cuero 50, ahumado 40, especiado cálido 40 |
| 2 | Estación en que más lo usarías | una opción | Verano → cítrico 50, fresco 50, tropical 30 · Invierno → especiado cálido 50, ámbar 50, vainilla 40 · Primavera/otoño → floral 40, aromático 30, empolvado 30 |
| 3 | Ocasión principal | una opción | Diario/trabajo → fresco, aromático, almizclado · Cita/noche → dulce, vainilla, ámbar · Formal → empolvado, iris, floral blanco · Deporte → acuático, ozónico, cítrico |
| 4 | ¿Cuánto dulzor? | escala 0-2 | nada → (agrega `dulce` a `avoid`) · algo → dulce 20 · mucho → dulce 60, vainilla 40, caramelo 30 |
| 5 | Estilo | una opción | Suave y limpio → almizclado, empolvado, fresco · Notorio → ámbar, especiado cálido, oud, cuero |
| 6 | Familias favoritas | multi | floral, amaderado, cítrico, ámbar/especiado cálido, aromático/lavanda |
| 7 | ¿Qué evitás? | multi | dulce, animalicio, ahumado, empolvado, oud, cuero, pachuli |

El género (femenino / masculino / unisex / cualquiera) es un **filtro** de la pantalla de resultados, no una pregunta.
La estación **no** se usa como filtro: el CSV de Fragrantica no trae `seasons`, así que filtraría todo el catálogo.

## Puntaje
Para un perfume candidato con intensidades `I[a]`:

```
w[a]   = ln(N / df[a])                      // IDF: N = perfumes totales, df = perfumes con ese acorde
score  = Σ w[a] · min(P[a], I[a]) / Σ w[a] · P[a]      ∈ [0, 1]
```

- Reutiliza la lógica de intersección ponderada de `accordScore` (`src/lib/similarity.ts`), generalizada para recibir un vector en vez de un perfume.
- `df` se calcula una vez al arrancar (o con caché de proceso): una consulta de agregación sobre `PerfumeAccord`.
  Sin IDF, `amaderado` (12.398 perfumes) y `dulce` (7.430) dominarían todo; `oud` (925) y `lavanda` (930) casi nunca ganarían.
- Rechazos: un perfume con un acorde de `avoid` en intensidad ≥ 60 queda **excluido** (score 0).
- Exclusiones de colección (`OWNED`, `DISLIKED`) como en el motor actual.
- Desempate: score, luego cantidad de acordes coincidentes, luego `id` (orden estable y testeable).

## Razones (explicabilidad)
Hasta 3 por resultado, con vocabulario cerrado:
- `matched_accords`: los 2-3 acordes que más aportaron al puntaje (`coincide en: amaderado, cítrico`).
- `avoids_rejected`: el perfume no tiene ninguno de los acordes rechazados (solo si el usuario marcó alguno).
- `collection_affinity`: reservada para cuando haya señal de colección.

## Candidatos y rendimiento
Hay 23.848 perfumes y 117.757 filas en `PerfumeAccord`. No se puntúan todos: una consulta pre-filtra perfumes con al menos
uno de los 5 acordes de mayor peso del perfil en intensidad ≥ 40, y el resto se puntúa en la aplicación. A medir en implementación:
tiempo de la consulta y del puntaje con perfiles reales (objetivo < 500 ms).

## API y UI
- `POST /api/quiz/recommendations` — body `{ answers, gender?, limit? }` → `{ data: [{ perfumeId, brand, name, score, reasons }], count }`.
  Mismo contrato que `/api/perfumes/[id]/recommendations`. Respuestas inválidas → 400.
- `/quiz`: formulario multi-paso con HTML nativo (funciona sin JS), como el de filtros del catálogo.
- `/quiz/resultado`: lista de resultados con razones y el filtro de género.
- Con sesión: `GET/PUT /api/quiz/profile` (o Server Action) para leer y guardar el perfil del usuario.

## Schema (requiere confirmación antes de aplicar)
```prisma
model UserProfile {
  userId      String   @id
  answers     Json
  quizVersion Int
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
Se guardan las **respuestas** (no el vector), así un cambio de `QUIZ_VERSION` permite recalcular. `onDelete: Cascade` cubre la eliminación de cuenta.
Cambio aditivo: no afecta tablas existentes.

## Plan por fases
1. **Lib pura + tests** (`src/lib/quiz/`): preguntas, construcción del vector, IDF, puntaje, razones. Sin DB. Test: todos los acordes del mapeo existen; el puntaje es determinista y está en [0, 1]; los rechazos excluyen.
2. **Endpoint** `POST /api/quiz/recommendations`, verificado con `curl` contra el dev server y datos reales (pegar la salida).
3. **UI** `/quiz` y `/quiz/resultado`.
4. **Persistencia** (schema `UserProfile`) con sesión.
5. **RF-05**: incluir `UserProfile` en la exportación y la eliminación de cuenta.

## Riesgos y preguntas abiertas
- Los pesos de las respuestas son una primera propuesta: conviene probarlos con perfiles de ejemplo (ej. "amante de lo dulce/gourmand", "fresco/cítrico de verano") y revisar que los resultados tengan sentido antes de la UI.
- El CSV trae `Rating Value` y `Rating Count` que no importamos. Podrían servir para desempatar por popularidad, pero requieren campos nuevos en `Perfume`.
- Las notas siguen en inglés; el quiz solo usa acordes (en español) por ahora.
