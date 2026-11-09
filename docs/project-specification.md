# Especificación oficial del proyecto: plataforma de perfumes

## 1. Estado, propósito y alcance

Este documento es el contrato de desarrollo del MVP. Las decisiones indicadas como aceptadas son vinculantes para la implementación; las pendientes requieren una decisión explícita antes de la fase correspondiente.

La plataforma ayuda a descubrir, comparar y organizar perfumes. El público inicial es hispanohablante de Latinoamérica, sin restricción geográfica de acceso. La interfaz de lanzamiento está en español, pero el modelo evita asumir un único país, moneda o idioma para su evolución futura.

### Objetivos del MVP

- Ofrecer un catálogo editorial pequeño, curado manualmente y trazable.
- Facilitar búsqueda, filtrado y comparación de perfumes con información consistente.
- Permitir a cada persona autenticada mantener una colección privada.
- Producir recomendaciones deterministas, explicables y útiles sin IA generativa.
- Proteger datos privados con Supabase Auth y políticas de seguridad a nivel de fila.

### Incluido en el MVP

- Catálogo de marcas, perfumes, variantes, notas, acordes e imágenes propias o licenciadas.
- Búsqueda textual y filtros multifacéticos.
- Ficha completa de perfume y comparador de hasta cuatro perfumes.
- Colección personal privada con estados, notas y puntuación personal opcional.
- Recomendaciones por reglas explícitas.
- Exportación y eliminación de cuenta.
- Validación de entradas, rate limiting proporcional, protección básica contra bots y navegación por teclado.

### Fuera de alcance del MVP

- Reseñas, ratings públicos, votos, reportes, moderación, auditoría de comunidad y perfiles públicos.
- Panel administrativo propio, RBAC de múltiples roles, MFA y gestión editorial mediante interfaz de la aplicación.
- Scraping, reutilización de datos o imágenes sin licencia clara, integraciones de precios o comparación de tiendas.
- Pagos, inventario, envíos, marketplace o garantías comerciales.
- Búsqueda semántica, embeddings, IA generativa y proveedores de modelos. Únicas excepciones, todas opcionales y apagadas por defecto: la frase de "¿Qué me pongo hoy?" (ADR-009), el cuadro para afinar las sugerencias de "¿Qué le falta a tu colección?" (ADR-010) y el cuadro de contexto de "¿Qué me pongo hoy?" (ADR-011).
- Cumplimiento formal completo de GDPR, CCPA u otros marcos; se implementan las funciones básicas de privacidad definidas aquí.
- Microservicios, backend NestJS separado, monorepo y API pública REST/OpenAPI como productos independientes.

## 2. Decisiones arquitectónicas aceptadas

| Área | Decisión |
| --- | --- |
| Aplicación | Una aplicación Next.js con TypeScript, App Router y directorio `src/`, ubicada en `web/`. |
| Plataforma | Supabase gestionado: PostgreSQL, Auth y Storage. |
| Backend de aplicación | Componentes y rutas de servidor de Next.js; no se crea un backend NestJS separado. |
| Datos | PostgreSQL gestionado por Supabase, con migraciones versionadas cuando se incorpore la herramienta correspondiente. |
| Identidad | Supabase Auth; no se autoaloja autenticación. |
| Acceso a datos | RLS en Supabase y una capa de servidor Next.js para casos de uso, caché y límites de abuso. |
| Catálogo | Creación y curaduría manual por el propietario mediante Supabase Studio o scripts, sin panel propio en MVP. |
| Imágenes | Supabase Storage, exclusivamente con activos propios o licenciados y procedencia registrada. |
| Comunidad | Diferida a V1 o posterior. |
| Recomendaciones | Motor determinista, explicable y sin dependencia de IA. |

## 3. Requisitos funcionales definitivos

### RF-01. Catálogo editorial

Un visitante puede explorar marcas y perfumes publicados. Cada ficha muestra los datos editoriales disponibles: marca, nombre, descripción, año cuando exista, variantes/concentraciones, notas por fase cuando corresponda, acordes, familia olfativa, imágenes permitidas y fecha de actualización. El catálogo no muestra borradores ni datos sin publicar.

### RF-02. Búsqueda y filtros

Un visitante puede buscar por nombre de perfume y marca. Puede combinar filtros por marca, concentración, familia olfativa, notas, acordes y atributos editoriales disponibles. Puede ordenar por relevancia y novedad editorial. El MVP no filtra ni ordena por precios de tiendas ni ratings públicos.

### RF-03. Comparación

Un visitante puede seleccionar entre dos y cuatro perfumes y ver sus atributos en una estructura homogénea: marca, variantes, concentración, notas, acordes, familia, imágenes disponibles y datos editoriales. Los atributos desconocidos se identifican como ausentes; no se infieren ni inventan equivalencias.

### RF-04. Colección personal privada

Una persona autenticada puede guardar un perfume en su colección y asignar uno o más estados controlados, inicialmente `owned`, `sampled` y `wishlist`. Puede actualizar o retirar esos estados, una nota privada opcional y una puntuación personal opcional. Ningún otro usuario ni visitante puede consultar estos datos.

### RF-05. Cuenta y privacidad básica

Una persona autenticada puede consultar y exportar los datos personales que la aplicación conserva para ella: preferencias, entradas de colección, notas y puntuaciones personales. Puede solicitar la eliminación de su cuenta y sus datos asociados, excepto la información mínima que deba conservarse temporalmente por seguridad operativa, definida antes del lanzamiento. No existe perfil público en el MVP.

### RF-06. Administración editorial fuera de la interfaz pública

El propietario carga y actualiza el catálogo directamente mediante Supabase Studio o scripts controlados. Los registros editoriales incluyen estado de publicación y procedencia para imágenes y datos cuya fuente corresponda registrar. La aplicación de usuario no contiene rutas, pantallas ni permisos administrativos.

### RF-07. Recomendaciones deterministas

El sistema recomienda perfumes publicados a partir de un perfume de referencia, filtros activos y, para una persona autenticada, señales explícitas de su colección. Cada resultado muestra razones basadas en datos observables, como notas, acordes, familia o afinidad con estados personales. Las recomendaciones deben funcionar aunque no exista ningún servicio de IA.

### RF-08. Regionalización preparada

El sistema admite preferencias de idioma, país/región y moneda como datos configurables. El lanzamiento utiliza español y no exige localización completa ni conversión de precios. No se integran precios comerciales en este MVP.

## 4. Requisitos no funcionales

### Seguridad y privacidad

- Supabase Auth administra credenciales y sesiones; la aplicación no almacena contraseñas.
- Las tablas con datos privados tienen RLS habilitada y políticas que limitan lectura y escritura al usuario propietario.
- La clave de servicio de Supabase solo puede existir en ejecución de servidor y nunca en el navegador ni en un archivo versionado.
- Las lecturas de catálogo público y las operaciones autenticadas se validan del lado servidor; el cliente no decide permisos de negocio.
- Toda entrada se valida en el límite del servidor y se escapa o sanitiza de acuerdo con su destino de presentación o consulta.
- Se aplican límites de tasa a autenticación, mutaciones de colección, exportación y eliminación de cuenta. El catálogo público se sirve con caché y límites razonables de consulta.
- La protección contra bots y scraping es de mitigación, no una promesa de impedir la copia de datos públicos: se combinan caché, límites, paginación acotada y controles de proveedor si se habilitan.
- Las colecciones, notas y puntuaciones no se indexan, registran ni exponen como contenido público.

### Rendimiento y operación

- Objetivo inicial: p95 menor a 2 s para catálogo, ficha, búsqueda y comparación bajo la carga de lanzamiento que se defina. Los flujos autenticados de escritura apuntan a p95 menor a 3 s.
- Las consultas de catálogo son paginadas y solo recuperan los campos necesarios para cada pantalla.
- La falta de recomendaciones no bloquea búsqueda, comparación ni ficha de perfume.
- Las migraciones, respaldos y restauración se definen y prueban antes de producción.
- Los logs técnicos no incluyen secretos, tokens ni texto privado de notas.

### Accesibilidad y experiencia

- La interfaz permite navegación completa por teclado, foco visible, estructura semántica, etiquetas accesibles y errores comprensibles.
- El diseño es responsive y se prueba en navegadores modernos que se definan antes del lanzamiento.
- La interfaz no depende únicamente de color, posición o imágenes para comunicar estados.
- Se usan formatos configurables de idioma, fechas y moneda, aunque el MVP se presente inicialmente en español.

### Mantenibilidad

- TypeScript se mantiene en modo estricto.
- El acceso a Supabase se concentra en adaptadores o servicios de servidor; los componentes visuales no contienen reglas de autorización ni secretos.
- Las reglas de recomendación se implementan como funciones deterministas, testeables y versionadas.
- La estructura evita acoplar el dominio de catálogo a Storage, Auth o una futura capa de IA.

## 5. Criterios de aceptación principales

| Funcionalidad | Criterio verificable |
| --- | --- |
| Catálogo | Dado un perfume publicado, un visitante ve su ficha y sus imágenes permitidas; un registro no publicado no aparece en navegación, búsqueda ni URL directa. |
| Búsqueda | Dada una consulta y filtros combinados, la respuesta contiene solo perfumes publicados que cumplen todos los filtros e informa claramente si no hay resultados. |
| Comparación | Dada una selección de 2 a 4 perfumes, se muestran los mismos campos para cada uno y no se permite una quinta selección. (RF-03: Completado) |
| Colección | Una persona autenticada puede crear, cambiar y eliminar sus estados, nota y puntuación personal. Otro usuario no puede leerlos ni alterarlos aun conociendo sus identificadores. |
| Privacidad | La exportación contiene solo los datos propios definidos. La eliminación impide futuros accesos a la cuenta y elimina o anonimiza los datos asociados conforme a la política documentada. |
| Catálogo editorial | Los datos cargados manualmente permanecen en borrador hasta publicarse y las imágenes tienen referencia de propiedad o licencia. |
| Recomendaciones | Sin IA ni proveedor externo, una ficha devuelve candidatos publicados con al menos una razón explicable basada en atributos del catálogo o señales privadas autorizadas. |
| Seguridad | Las consultas directas con credenciales de un usuario no obtienen colecciones de otro; la clave de servicio no se entrega al cliente. |
| Accesibilidad | Los flujos de búsqueda, comparación, acceso y colección se completan por teclado con foco y mensajes de error perceptibles. |

## 6. Modelo de dominio conceptual

| Concepto | Responsabilidad y relaciones |
| --- | --- |
| `Brand` | Marca editorial; agrupa perfumes publicados o en borrador. |
| `Perfume` | Producto conceptual de una marca: nombre, descripción, año y atributos editoriales. Se relaciona con variantes, notas, acordes, familia, imágenes y procedencia. |
| `PerfumeVariant` | Concentración o presentación concreta del perfume, con tamaño u otros atributos propios si existen. |
| `OlfactoryNote`, `OlfactoryFamily` y `Accord` | Vocabularios controlados para describir perfumes; una nota puede tener fase olfativa. |
| `CatalogImage` | Activo de Storage asociado a un perfume o variante, con ruta, texto alternativo, titularidad/licencia y estado de publicación. |
| `ProvenanceRecord` | Registro editorial de procedencia de un dato o imagen: referencia, responsable y fecha. |
| `UserProfile` | Registro local mínimo ligado al identificador estable de Supabase Auth. Contiene preferencias regionales y nunca expone datos privados por defecto. |
| `CollectionEntry` | Relación privada entre una persona y un perfume: estados, nota, puntuación y marcas temporales. |
| `RecommendationCandidate` | Resultado transitorio con perfume candidato, puntaje y razones; no requiere persistencia inicial. |
| `Locale`, `Country`, `Region` y `Currency` | Referencias de configuración preparadas para futura localización. No implican precios comerciales en MVP. |

### Invariantes

- Un perfume pertenece a una marca y una variante pertenece a un perfume.
- Solo los registros publicados son visibles en el catálogo público.
- Todo activo de imagen publicado tiene propiedad o licencia registrada.
- Una entrada de colección pertenece a una única persona y no es pública.
- Los estados de colección pertenecen al vocabulario controlado definido por la aplicación.
- La puntuación personal es privada, opcional y no contribuye a un rating público.
- El identificador de Auth es estable y no se usa correo u otro dato mutable como clave de propiedad.
- La regionalización no determina acceso geográfico ni bloquea a visitantes.

## 7. Límites y contratos técnicos

### Next.js ↔ Supabase

- Supabase Auth provee identidad; Next.js obtiene y valida la sesión en el servidor mediante los adaptadores oficiales que se instalen en la fase de integración.
- PostgreSQL es la fuente de verdad. RLS es el límite de seguridad de datos privados y se prueba directamente con sesiones de usuarios distintos.
- Supabase Storage guarda archivos de catálogo. La aplicación persiste metadatos, texto alternativo y licencia; la ruta de Storage no sustituye esos metadatos.
- Las claves públicas de proyecto pueden usarse solo según el modelo de Supabase; las claves de servicio permanecen exclusivamente en el entorno servidor.

### Navegador ↔ aplicación Next.js

- Los componentes de cliente solicitan acciones y datos a través de Server Components, Server Actions o Route Handlers definidos por el caso de uso.
- El navegador no recibe acceso privilegiado ni claves de servicio. La aplicación no confía en estados del cliente para propiedad, publicación o autorización.
- No se publica una API REST/OpenAPI independiente en el MVP. Si se agrega una API futura, requerirá un ADR y un contrato versionado.

### Dominio ↔ infraestructura

- Catálogo, colección y recomendaciones se expresan como funciones o casos de uso de TypeScript independientes de páginas y componentes visuales.
- Los adaptadores de Supabase encapsulan consultas, sesión y Storage. Las reglas de recomendación no dependen de IA, SDKs de autenticación ni componentes de interfaz.

## 8. Áreas de la aplicación

- Descubrimiento: inicio, exploración, búsqueda, filtros y resultados.
- Ficha de perfume: datos editoriales, variantes, imágenes, acordes/notas, comparación y recomendaciones.
- Comparador: selección temporal y tabla accesible de hasta cuatro perfumes.
- Cuenta: acceso mediante Supabase Auth, preferencias y privacidad.
- Colección privada: estados, notas y puntuación personal.
- Fundaciones: formato regional, accesibilidad, errores, caché y cliente/servicios de Supabase.

No se crean áreas de comunidad, perfiles públicos ni administración editorial para usuarios dentro del MVP.

## 9. Estrategia de autenticación, autorización y privacidad

Supabase Auth es el proveedor aceptado. La aplicación usa su identificador de usuario como vínculo con `UserProfile` y `CollectionEntry`. No autoaloja identidad ni almacena contraseñas.

El único rol de producto del MVP es una persona autenticada que administra sus propios datos. La edición de catálogo queda fuera de la aplicación y se realiza por el propietario en Studio o scripts; por eso no se modelan roles `editor`, `moderator` o `administrator` todavía.

RLS aplica, como mínimo, estas políticas:

- Catálogo: lectura solo de registros publicados para las rutas o consultas públicas definidas; no hay escritura desde usuarios finales.
- Perfil: una persona lee y actualiza únicamente su perfil permitido.
- Colección: una persona crea, lee, actualiza y elimina exclusivamente sus propias entradas.
- Imágenes: los objetos publicados se leen conforme a la estrategia de entrega elegida; la subida y edición editorial no se expone a usuarios finales.

La exportación reúne datos propios de las tablas privadas y se ofrece en un formato interoperable. La eliminación revoca la cuenta de Auth y elimina o anonimiza sus filas privadas de forma transaccional y documentada. Antes de implementarla se definirá una política mínima de retención operativa para errores, respaldos y abuso.

## 10. Estrategia de búsqueda inicial

PostgreSQL en Supabase resuelve la búsqueda inicial. Se implementa búsqueda textual normalizada para nombres de perfumes y marcas, complementada con filtros relacionales indexados para vocabularios controlados. La relevancia prioriza coincidencia exacta de nombre, coincidencia de marca y coincidencia textual; después aplica un orden estable.

Los filtros se combinan con AND, se ejecutan únicamente sobre catálogo publicado y usan paginación. Las opciones se derivan de atributos existentes en registros publicados. La tolerancia a acentos y coincidencias parciales se valida con el dataset inicial; una extensión o un índice adicional solo se agrega si la compatibilidad de Supabase y la evidencia de relevancia lo justifican.

Un índice especializado, semántico o con embeddings está fuera del MVP. La extracción se considera solo si las métricas de latencia, volumen o relevancia evidencian que PostgreSQL no alcanza los objetivos.

## 11. Arquitectura de recomendaciones deterministas

El motor recibe perfume de referencia o filtros, candidatos publicados y, si existe sesión, señales privadas permitidas de la colección. Devuelve candidatos con puntaje desglosado y razones codificadas y legibles.

Puntaje inicial propuesto, sujeto a prueba con el dataset editorial:

- coincidencia de notas, acordes y familia olfativa: 55 %;
- coincidencia de concentración o variante cuando aplique: 20 %;
- afinidad con estados y puntuación personal privada: 20 %;
- diversidad controlada entre resultados: 5 %.

Sin sesión, las señales privadas valen cero y los pesos restantes se normalizan. Solo se recomiendan registros publicados; exclusiones y filtros prevalecen sobre el puntaje. Ejemplos de razones son `shared_olfactory_family`, `shared_notes` y `matches_collection_preference`.

Los pesos y reglas se versionan en código y se protegen mediante casos de prueba de ranking. No se usan modelos generativos, embeddings, datos sensibles ni comportamiento no consentido.

## 12. Frontera de una futura capa de IA

La IA no forma parte del MVP. Si se incorpora posteriormente, será un adaptador opcional detrás de una interfaz de aplicación, sin cambiar las entidades ni reemplazar reglas deterministas. Podrá enriquecer explicaciones o interpretar consultas, pero la validación, seguridad y elegibilidad de catálogo seguirán siendo deterministas.

Su diseño deberá permitir proveedores locales como Ollama y proveedores cloud intercambiables, con degradación completa hacia búsqueda y recomendaciones sin IA. Cualquier envío de datos privados a un proveedor requerirá una decisión específica de privacidad, consentimiento y retención.

## 13. Estrategia de testing

| Nivel | Alcance | Ejemplos |
| --- | --- | --- |
| Unitario | Reglas y funciones puras. | Estados de colección, ranking, razones y normalización de búsqueda. |
| Integración | PostgreSQL/Supabase y RLS en entorno de prueba. | Aislamiento entre usuarios, publicación de catálogo y consultas filtradas. |
| Aplicación | Rutas de servidor, sesión y validación. | Sesión inválida, exportación y eliminación de cuenta. |
| End-to-end | Flujos críticos del navegador. | Buscar, filtrar, comparar, iniciar sesión y administrar la colección. |
| Accesibilidad | Revisión automatizada y manual de flujos principales. | Teclado, foco, etiquetas, errores y contenido dinámico. |
| Seguridad/rendimiento | Riesgos proporcionales antes de producción. | RLS, exposición de secretos, abuso de mutaciones y objetivos de latencia. |

Los datos de prueba son sintéticos o editorialmente permitidos. Cada requisito funcional tiene una prueba automatizada o un protocolo manual reproducible. Los rankings usan conjuntos fijos para detectar regresiones.

## 14. ADRs

### ADR-001 — Next.js y Supabase como plataforma única

**Estado:** aceptada. Se reemplaza el monorepo con NestJS por una aplicación Next.js y Supabase gestionado. La decisión reduce infraestructura, costo inicial y curva de aprendizaje, a cambio de aceptar una arquitectura menos separada operativamente.

### ADR-002 — Supabase Auth para identidad

**Estado:** aceptada. Supabase Auth administra credenciales y sesiones. Se evita autoalojar identidad; la propiedad de datos usa el identificador estable del usuario y RLS impone el aislamiento.

### ADR-003 — RLS como límite de datos privados

**Estado:** aceptada. Las colecciones, notas y puntuaciones se protegen en PostgreSQL mediante RLS, además de verificaciones de aplicación. No se confía únicamente en la interfaz para ocultar información.

### ADR-004 — Catálogo manual y con activos legítimos

**Estado:** aceptada. El propietario incorpora catálogo e imágenes mediante Studio o scripts. No hay scraping ni fuentes/imágenes sin licencia. Se registra procedencia para conservar trazabilidad.

### ADR-005 — Sin comunidad ni administración propia en MVP

**Estado:** aceptada. Reseñas, perfiles, moderación, auditoría y RBAC se posponen a V1. La administración editorial no expone una interfaz en la aplicación.

### ADR-006 — PostgreSQL para búsqueda inicial

**Estado:** aceptada. La búsqueda textual y los filtros se resuelven con PostgreSQL/Supabase. Se evita infraestructura adicional, embeddings e IA hasta que las métricas demuestren una necesidad.

### ADR-007 — Recomendación determinista y explicable

**Estado:** aceptada. Las recomendaciones funcionan sin IA y muestran sus razones. La IA futura será opcional y no se acoplará al dominio.

### ADR-008 — Privacidad práctica antes de cumplimiento formal

**Estado:** aceptada. El MVP ofrece aislamiento de datos, exportación y eliminación de cuenta, sin declarar cumplimiento integral de marcos regulatorios. Cualquier afirmación legal futura exige revisión especializada.

### ADR-009 — Frase opcional redactada por IA en "¿Qué me pongo hoy?"

**Estado:** aceptada. El ranking de la colección según el clima es 100 % determinista y no depende de ningún modelo. Un modelo externo (Gemini, nivel gratuito) puede redactar, solo si `OUTFIT_LLM_ENABLED=true`, una frase de hasta dos oraciones sobre el perfume ya elegido. Recibe únicamente un resumen del clima y marca, nombre y acordes de ese perfume; nunca identidad, ubicación ni colección. Ante cualquier fallo se usa una frase de plantilla. Detalle en `web/docs/clima-que-me-pongo.md`.

### ADR-010 — Cuadro para afinar las sugerencias con IA en "¿Qué le falta a tu colección?"

**Estado:** aceptada. El análisis de huecos, el ranking y los candidatos son 100 % deterministas y no dependen de ningún modelo (misma regla que la ADR-009). Un modelo externo (Gemini, nivel gratuito) puede intervenir **solo si `COLLECTION_LLM_ENABLED=true` y solo cuando la persona escribe** algo en el cuadro "afinar": interpreta ese texto y devuelve **filtros estructurados** de listas cerradas (familias olfativas, estación, día/noche, duración, estela y un perfume de referencia por nombre). El modelo no elige ni nombra perfumes: el ranking del catálogo aplica los filtros y los candidatos salen siempre del catálogo. La explicación que ve la persona ("busqué perfumes nocturnos y de larga duración") se arma con una plantilla a partir de los filtros, no con texto del modelo.

- **Qué recibe el modelo:** únicamente el texto que la persona escribió (máximo 200 caracteres, saneado) y las instrucciones fijas con el vocabulario permitido. Nunca su colección, ids, notas, puntajes, correo, apodo ni ubicación, ni los candidatos. La interfaz avisa que no se escriban datos personales. Por decisión de la persona propietaria (2026-10-16) ya no menciona que, en el nivel gratuito, Google puede usar el contenido para mejorar sus productos; ese riesgo fue aceptado y sigue vigente.
- **Qué se acepta de vuelta:** un JSON validado contra el vocabulario; todo valor fuera de la lista se descarta y el texto libre del modelo no se muestra. Si la respuesta es inválida, hay un fallo del proveedor o está en enfriamiento, no se afinan las sugerencias y se avisa.
- **Límites:** frecuencia por persona propia (2 por minuto), un solo intento con timeout corto, enfriamiento compartido con las demás funciones con IA, y caché por texto normalizado (sin identidad).
- **Alcance de "ocasión":** el catálogo solo distingue día y noche. "Ocasión especial" se aproxima con noche, duración larga y estela fuerte, y la interfaz lo dice.
- Lo ya decidido sigue valiendo: la lista de deseados puede aparecer con etiqueta, los descartados excluyen solo ese perfume, y la estela y "no explorado" nunca se presentan como logro ni como hueco. Detalle en `web/docs/que-le-falta-a-mi-coleccion.md`.

### ADR-011 — Cuadro de contexto con IA en "¿Qué me pongo hoy?"

**Estado:** aceptada. Es la misma regla de la ADR-010 aplicada a otra pantalla: el ranking de la colección según el clima sigue siendo 100 % determinista y el modelo nunca elige perfumes. Con `OUTFIT_CONTEXT_LLM_ENABLED=true` y solo cuando la persona escribe algo ("voy a ver un partido de vóley en un lugar cerrado"), un modelo externo (Gemini, nivel gratuito) traduce ese texto a **tres filtros de listas cerradas**: discreción (`alta` o `media`), liviano o intenso, y proyección marcada. El motor los aplica como un factor sobre el puntaje de cada perfume de la colección, calculado con datos propios (estela votada por la comunidad y peso de los acordes densos o dulces): con discreción alta, un perfume invasivo no puede ser la primera opción salvo que no haya otro más suave. La explicación que ve la persona se arma con una plantilla a partir de los filtros, no con texto del modelo.

- **Qué recibe el modelo:** únicamente el texto escrito (máximo 200 caracteres, saneado) y las instrucciones fijas con el vocabulario. Nunca su colección, ubicación, clima, correo, apodo ni perfumes. La interfaz avisa que no se escriban datos personales y que, en el nivel gratuito, Google puede usar el contenido; la persona propietaria aceptó ese riesgo el 2026-10-16.
- **Qué se acepta de vuelta:** un JSON validado contra el vocabulario; lo demás se descarta. Si la interpretación falla, no se entiende o hay enfriamiento, la recomendación se muestra igual, sin el contexto, y se avisa.
- **Separación de flags:** `OUTFIT_CONTEXT_LLM_ENABLED` es independiente de `OUTFIT_LLM_ENABLED` (la frase de la ADR-009) porque los datos que viajan son distintos. Comparten `GEMINI_API_KEY`, `GEMINI_MODEL` y el enfriamiento del proveedor.
- **Límites:** 3 interpretaciones por minuto por persona, un solo intento con timeout corto y caché por texto normalizado (sin identidad).

## 15. Roadmap verificable

| Fase | Entregable | Estado o criterio de salida |
| --- | --- | --- |
| 0. Contrato | Especificación alineada con las decisiones aprobadas. | Completada con este documento. |
| 1. Base de aplicación | Proyecto Next.js en `web/`, TypeScript, App Router y ESLint. | Completada: `npm run build` termina correctamente. |
| 2. Conexión Supabase | Proyecto de desarrollo, dependencias oficiales, variables locales no versionadas y sesión. | Inicio/cierre de sesión contra Supabase de desarrollo, sin secretos en el repositorio. |
| 3. Datos y RLS | Migraciones para catálogo, perfiles, colección y Storage; políticas RLS probadas. | Dos usuarios de prueba no pueden acceder a datos privados ajenos. |
| 4. Catálogo y búsqueda | Dataset permitido, fichas, búsqueda, filtros e imágenes. | RF-01, RF-02 y publicación de catálogo verificados. |
| 5. Comparación y colección | Comparador y flujos privados de estados, notas y puntuación. | RF-03 y RF-04 verificados por pruebas y teclado. |
| 6. Privacidad y recomendaciones | Exportación/eliminación y motor determinista explicable. | RF-05 y RF-07 verificados sin IA. |
| 7. Lanzamiento | Límites, caché, pruebas de accesibilidad, seguridad y respaldo. | Checklist de salida y objetivos no funcionales aprobados. |
| V1 posterior | Comunidad, perfiles, moderación, administración UI o IA, si los usuarios lo justifican. | Nueva especificación y ADR antes de implementar. |

## 16. Pendientes antes de las siguientes fases

- Crear o identificar un proyecto de Supabase de desarrollo bajo control del propietario.
- Definir el mecanismo concreto de acceso a ese proyecto sin exponer claves de servicio en conversación ni archivos versionados.
- Definir la política mínima de retención para eliminación de cuenta y restauración de respaldos.
- Acordar los estados definitivos de colección, escala de puntuación personal y dataset editorial inicial.
- Definir el proveedor o nivel de protección anti-bot si los límites nativos y de aplicación no bastan.
- Aprobar cada instalación de dependencias adicional antes de ejecutarla.

Ninguna decisión pendiente debe resolverse de manera implícita en código. Esta especificación sustituye la versión anterior y es el contrato vigente para el MVP.
