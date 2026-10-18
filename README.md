# Scentia

**Perfumes con contexto.** Scentia es una guía de perfumes para descubrir qué te gusta, llevar el control de tu colección y elegir qué ponerte cada día. Explorás un catálogo de más de 41.000 perfumes, respondés un quiz olfativo y la app te recomienda con razones que se entienden: qué acordes coinciden, qué le falta a tu colección, qué te conviene según el clima y el plan del día.

- **Sitio:** https://scentia-bice.vercel.app
- **Sin fines de lucro.** Los datos del catálogo vienen de la comunidad de Fragrantica (ver [Datos y créditos](#datos-y-créditos)).

---

## Qué podés hacer

### Sin crear cuenta
- **Explorar el catálogo** (`/perfumes`): buscá por marca o nombre y filtrá por acorde, estación y género. Cada ficha muestra los acordes con su intensidad, las notas por fase, estaciones, momento del día, duración, estela, los votos de la comunidad y el carrusel **"Me recuerda a"** con perfumes que la comunidad dice que huelen parecido.
- **Comparar** de 2 a 4 perfumes lado a lado, con un gráfico de radar de sus acordes.
- **Recorrer marcas** (`/marcas`).
- **Hacer el quiz olfativo** (`/quiz`): unas pocas preguntas sobre ambientes, estación, ocasión, dulzor, estilo, duración y estela, familias que te gustan y qué querés evitar. Opcionalmente elegís hasta 3 perfumes que ya amás y buscamos otros parecidos. Los resultados muestran tu afinidad con cada perfume y por qué.
- **Ver el perfume del día** en la portada.

### Con cuenta
- **Mi colección** (`/mi-coleccion`): guardá cada perfume como *Lo tengo*, *Probé una muestra*, *Lista de deseados* o *Descartado*, con tu puntuación y notas privadas.
- **¿Qué le falta a tu colección?**: un análisis de qué familias olfativas, estaciones, momentos del día y duraciones casi no tenés, con sugerencias del catálogo para cubrirlos. Podés filtrar por género y, si la función está activa, afinar las sugerencias con un texto libre ("algo fresco para el verano").
- **¿Qué me pongo hoy?** (`/que-me-pongo`): elige un perfume de *tu* colección según el clima de tu ciudad. Si la función está activa y contás qué vas a hacer ("voy a ver un partido en un lugar cerrado"), baja a los perfumes muy invasivos.
- **Racha diaria**: registrá qué perfume usaste hoy y mantené tu racha.
- **Perfil guardado**: tu perfil del quiz queda guardado para la próxima vez.
- **Mi cuenta** (`/account`): cambiá tu apodo, tus preferencias y tu contraseña, descargá todos tus datos en JSON o eliminá tu cuenta.

---

## Primeros pasos

1. Entrá a **Crear cuenta** con tu correo, un apodo (opcional) y una contraseña de 6 o más caracteres. Te llega un correo para **confirmar** la cuenta.
2. También podés ingresar con un **enlace por correo**. En ese caso Scentia te pide elegir una contraseña la primera vez.
3. ¿Olvidaste tu contraseña? Desde **Ingresar**, pedí el enlace: al abrirlo elegís una nueva sin necesitar la anterior.
4. Hacé el **quiz**, guardá tu perfil y empezá a cargar tu colección desde las fichas de los perfumes.

---

## Tu privacidad

- Tu colección, tus notas y tu perfil son **privados**: solo los ves vos.
- Podés **descargar** todo lo que guardamos de vos (`/account` → *Descargar mis datos*).
- Si **eliminás tu cuenta**, se borran tus datos personales, tus notas y tu acceso. Lo único que queda es un **resumen anónimo** para estadísticas (cuántas cuentas hubo, cuántos perfumes tenían en la colección, rachas): sin correo, nombre, apodo ni notas, con un identificador nuevo y solo el mes de alta y de baja. No hay forma de volver a vincularlo con vos.
- Las funciones con IA son **opcionales** y la IA solo interpreta el texto que escribís; los perfumes los elige siempre el catálogo o tu colección. Por eso: **no escribas datos personales** en esos cuadros.
- Las fotos de los frascos se muestran enlazadas desde su origen; Scentia no las aloja.

---

## Datos y créditos

Los acordes, notas, estaciones, duración, estela y votos provienen del dataset [Fragrantica Perfumes: Ratings, Notes, Votes & More](https://www.kaggle.com/datasets/ledecanteur/fragrantica-perfumes) (Kaggle, **CC BY-NC-SA 4.0**), recopilado de la comunidad de Fragrantica. Scentia no está afiliada a Fragrantica ni a ninguna marca. Detalle completo en `/creditos`.

---

## Para quien lo instala y lo mantiene

Scentia es una aplicación Next.js 16 con Prisma 7 sobre Postgres de Supabase (que además maneja el acceso), desplegada en Vercel. El código vive en [`web/`](web/).

### Correrlo en tu máquina

Necesitás Node.js 20.9 o superior (probado con 24) y un proyecto de Supabase con la base cargada.

```bash
cd web
npm install                 # también genera el cliente de Prisma
cp .env.example .env.local  # completá las variables (ver abajo)
npm run dev                 # http://localhost:3000
```

Variables mínimas en `.env.local` (la plantilla [`web/.env.example`](web/.env.example) explica cada una):

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a Postgres (en producción, el pooler en modo transacción, puerto 6543) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Proyecto de Supabase (acceso y cuentas) |
| `SITE_URL` | Dominio público con `https://`; obligatoria en producción (destino de los enlaces de acceso) |

Opcionales: `SUPERADMIN_EMAILS` (quién ve la auditoría), `SUPABASE_SERVICE_ROLE_KEY` (borrar también la identidad de Auth al eliminar una cuenta) y las variables de IA (`GEMINI_API_KEY`, `GEMINI_MODEL` y los interruptores `OUTFIT_LLM_ENABLED`, `COLLECTION_LLM_ENABLED`, `OUTFIT_CONTEXT_LLM_ENABLED`). Sin ellas, la IA queda apagada y todo lo demás funciona igual. **Nunca subas valores reales al repositorio.**

### Comandos útiles (desde `web/`)

```bash
npm run build      # compilar para producción
npm run start      # servir lo compilado
npm run lint       # ESLint
npm run smoke      # prueba de humo contra un servidor en marcha
npm run a11y       # auditoría de accesibilidad (axe) de las páginas públicas
node --experimental-strip-types --test $(find src -name "*.test.ts")   # tests unitarios
```

### Superadmin

Quien tenga su correo (confirmado) en `SUPERADMIN_EMAILS` ve `/admin/auditoria`: cuentas, altas y bajas por mes, perfumes en colecciones y todos los perfumes guardados, siempre como números agregados. Para el resto, la ruta no existe.

### Despliegue

Guía paso a paso (Supabase, Vercel, correo, verificación): [`web/docs/despliegue.md`](web/docs/despliegue.md).

### Documentación

| Tema | Dónde |
|---|---|
| Cuentas y contraseña | [`web/docs/cuenta-con-contrasena.md`](web/docs/cuenta-con-contrasena.md) |
| Eliminar cuenta y resumen anónimo | [`web/docs/retencion-eliminacion-cuenta.md`](web/docs/retencion-eliminacion-cuenta.md) |
| Quiz olfativo | [`web/docs/quiz-perfil-olfativo.md`](web/docs/quiz-perfil-olfativo.md) |
| ¿Qué le falta a tu colección? | [`web/docs/que-le-falta-a-mi-coleccion.md`](web/docs/que-le-falta-a-mi-coleccion.md) |
| ¿Qué me pongo hoy? | [`web/docs/clima-que-me-pongo.md`](web/docs/clima-que-me-pongo.md) |
| Comparador | [`web/docs/rf03-comparador.md`](web/docs/rf03-comparador.md) |
| Seguridad (CSP) | [`web/docs/seguridad-csp.md`](web/docs/seguridad-csp.md) |
| Accesibilidad | [`web/docs/accesibilidad.md`](web/docs/accesibilidad.md) |
| Identidad visual | [`web/docs/identidad-visual.md`](web/docs/identidad-visual.md) |
| Auditoría del superadmin | [`web/docs/auditoria-superadmin.md`](web/docs/auditoria-superadmin.md) |

### Ramas

`development` es la rama de integración y `main` es la que despliega Vercel.

---

## Licencia

El código se distribuye bajo la [licencia MIT](LICENSE). Los datos del catálogo no están incluidos en el repositorio y se rigen por la licencia de su origen (CC BY-NC-SA 4.0, ver [Datos y créditos](#datos-y-créditos)); el uso comercial de esos datos no está permitido. Los logos y el material de marca de `web/assets` y `web/public/brand` son parte del proyecto Scentia.
