# Compartir colección por link — diseño (v1)

Fecha: 2026-10-23. Estado: diseño aprobado en conversación; pendiente de revisión de este documento.

## Objetivo

Una persona genera un link y se lo manda a otra para mostrarle qué perfumes tiene (`OWNED`, con su puntuación si lo permite) o cuáles quiere (`WISHLIST`). Quien abre el link no necesita cuenta.

Éxito: generar el link en pocos clics, abrirlo en el celular y ver la lista sin iniciar sesión; poder dejar de compartir en cualquier momento.

## Decisiones tomadas

- El link es **en vivo**: lee la colección actual en cada visita (sin copia de datos).
- Alcance **mínimo seguro**: dos links (tengo / quiero), revocables, con casilla "mostrar puntuaciones". Fuera de la v1: perfumes propios, vencimiento e imagen Open Graph.
- Alternativas descartadas: perfil público por apodo (no revocable) y token firmado sin tabla (no revocable sin lista de bloqueo).

## Datos

Modelo nuevo `CollectionShare`:

| Campo | Detalle |
| --- | --- |
| `id` | cuid |
| `userId` | relación a `User`, `onDelete: Cascade` |
| `scope` | enum `OWNED` \| `WISHLIST` |
| `showRatings` | booleano; solo tiene efecto en `OWNED` |
| `tokenHash` | SHA-256 del token, único |
| `createdAt` | fecha de creación |

- Único `(userId, scope)`: un link por persona y tipo. Generar de nuevo reemplaza el anterior y lo invalida.
- Token: 32 bytes aleatorios en base64url. Se muestra una sola vez al crearlo; en la base solo queda el hash. Si se pierde, se regenera.
- SQL en `web/prisma/sql/2026-10-23-collection-share.sql`, que aplica la persona a mano (sin `db push`). Hay que actualizar `schema.prisma` y el respaldo (`scripts/backup-plan.ts`).

## Lectura pública `/c/[token]`

- Busca por hash. Si no existe o fue revocado: 404 genérico (misma respuesta, sin distinguir causas).
- Consulta `UserCollection` con `status = scope` y `perfume.status = PUBLISHED`. Por construcción excluye perfumes propios (`PRIVATE`).
- Campos expuestos: `brand`, `name`, `imageUrl`, `gender` y `rating` (solo si `showRatings` y `scope = OWNED`). Nunca `personalNotes`, email ni ids internos de la persona.
- Nombre visible: el apodo (`UserProfile.nickname`) o "Una colección" si no hay.
- Cabeceras: `noindex`, `Referrer-Policy: no-referrer`. Rate-limit por IP con `src/lib/rate-limit.ts`.
- La ruta debe entrar en el `matcher` de `src/proxy.ts` como pública y respetar la CSP.

## Gestión (`/mi-coleccion`)

- Bloque "Compartir" con dos tarjetas (Lo tengo / Lo quiero).
- Cada tarjeta: casilla de puntuaciones (solo "Lo tengo"), botón Generar link, Copiar (con `navigator.share` en el celular) y Dejar de compartir.
- Aviso en la interfaz: el link muestra la colección actual; cambiar el estado de un perfume lo mueve de una lista a otra.
- Server Actions en `src/app/actions/share.ts`, con las mismas guardas de autenticación que `collection.ts`.

## Código

- `src/lib/share/`: generar y hashear el token, armar la vista pública (lógica pura, con tests).
- Las tarjetas públicas reutilizan los componentes del catálogo en modo lectura (sin acciones).

## Pruebas

- Unitarias: token (largo, aleatoriedad, hash), filtrado de campos, `showRatings` falso oculta puntuaciones.
- Contra la base real: aislamiento entre personas, un perfume propio no aparece, revocar invalida el link, regenerar invalida el anterior.
- Smoke y accesibilidad de `/c/<token de prueba>`.

## Documentación a actualizar

`docs/compartir-coleccion.md` (nuevo), `docs/retencion-eliminacion-cuenta.md` (los links se borran en cascada con la cuenta) y `web/PROGRESS.md`.

## Riesgos

- Quien tiene el link puede reenviarlo; lo cubre la revocación.
- Un link de "Lo tengo" no puede mostrar y ocultar puntuaciones a la vez (un solo link por tipo).
- Un token filtrado en logs o historial: por eso `no-referrer`, hash en la base y 404 uniforme.
