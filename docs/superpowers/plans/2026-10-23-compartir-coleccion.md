# Compartir colección por link — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** una persona genera un link revocable que muestra, sin sesión, su colección «Lo tengo» (con puntuaciones opcionales) o su lista «Lo quiero».

**Arquitectura:** tabla `CollectionShare` con token aleatorio guardado como hash SHA-256; ruta pública `/c/[token]` que lee `UserCollection` en vivo filtrando por `scope`; bloque «Compartir» en `/mi-coleccion` con dos Server Actions (crear/regenerar y revocar). La lógica pura (token y vista pública) vive en `src/lib/share/` y se prueba con `node --test`.

**Tech Stack:** Next.js 16.4 (App Router; leer la guía en `node_modules/next/dist/docs/` antes de escribir páginas, ver `web/AGENTS.md`), Prisma 7 + Postgres (Supabase), `node:test`. Todo en `web/`.

**Spec:** `docs/superpowers/specs/2026-10-23-compartir-coleccion-design.md`

## Global Constraints

- Texto visible y documentación en español; identificadores, archivos y carpetas en inglés.
- Token: 32 bytes aleatorios en base64url (43 caracteres); en la base solo el SHA-256 (hex). Se muestra una sola vez.
- Un link por `(userId, scope)`; regenerar reemplaza el anterior.
- Campos públicos: `brand`, `name`, `imageUrl`, `gender` y `rating` (solo si `scope = OWNED` y `showRatings`). Nunca `personalNotes`, email ni ids de la persona.
- Solo perfumes con `status = PUBLISHED` (los `PRIVATE` y `DRAFT` quedan fuera).
- Token inválido, revocado o inexistente: 404 genérico. Cabeceras `noindex` y `Referrer-Policy: no-referrer`.
- Sin dependencias nuevas. El SQL lo aplica la persona a mano (sin `db push`); toda tabla nueva lleva RLS activado.
- Commits, merges, SQL en Supabase y cualquier instalación solo con confirmación explícita (`AGENTS.md`). Los pasos «Commit» se ejecutan únicamente si la persona los confirmó.
- Rama de trabajo: `feat/compartir-coleccion`, creada desde `development`.

## Review Focus

- Token con caracteres raros o enorme (`/c/<5000 chars>`, `%00`): 404 sin tocar la base (Task 1).
- Persona sin apodo: se muestra «Una colección», sin email ni «null» (Task 2).
- `WISHLIST` guardado con `showRatings = true`: igual no muestra puntuaciones (Task 2).
- Un perfume que pasa de `OWNED` a otro estado, o se despublica, desaparece del link sin regenerarlo (Task 4).
- Link regenerado o revocado: el token viejo da 404 (Task 4).
- Lista vacía: mensaje de «todavía no hay perfumes», no un error (Task 6).

---

### Task 1: Token (generar, hashear, validar formato)

**Files:**
- Create: `src/lib/share/token.ts`
- Test: `src/lib/share/token.test.ts`

**Interfaces:**
- Produces: `generateShareToken(): { token: string; tokenHash: string }`, `hashShareToken(token: string): string`, `isValidShareToken(value: unknown): value is string`.

- [ ] **Step 1: Crear la rama.** `git switch development && git switch -c feat/compartir-coleccion`.
- [ ] **Step 2: Escribir `token.test.ts`** con estas pruebas (`describe('token de link')`):
  - `generateShareToken` devuelve un `token` de 43 caracteres que cumple `/^[A-Za-z0-9_-]{43}$/` y un `tokenHash` de 64 hex.
  - Dos llamadas devuelven tokens distintos.
  - `hashShareToken(token) === tokenHash` y es determinista.
  - `isValidShareToken` es `true` para un token generado y `false` para `''`, `'a'.repeat(42)`, `'a'.repeat(44)`, `'a'.repeat(42) + '%'`, `'a'.repeat(5000)`, `null`, `123`.
- [ ] **Step 3: Correr y ver el fallo.** Run: `node --test src/lib/share/token.test.ts`. Expected: FAIL (módulo no existe).
- [ ] **Step 4: Implementar en `src/lib/share/token.ts`** con `node:crypto` (`randomBytes(32).toString('base64url')`, `createHash('sha256')`). Importar sin alias de `@/` (los tests de `src/lib` usan rutas relativas con extensión `.ts`).
- [ ] **Step 5: Correr y ver que pasa.** Run: `node --test src/lib/share/token.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** (solo con confirmación): `git add src/lib/share && git commit -m "feat: token de links para compartir colección"`.

### Task 2: Vista pública pura (filtrado de campos)

**Files:**
- Create: `src/lib/share/view.ts`
- Test: `src/lib/share/view.test.ts`

**Interfaces:**
- Produces:
  - `type ShareScope = 'OWNED' | 'WISHLIST'`
  - `parseShareScope(value: unknown): ShareScope | null`
  - `type SharedRow = { rating: number | null; perfume: { id: string; brand: string; name: string; gender: string; imageUrl: string | null } }`
  - `type PublicEntry = { id: string; brand: string; name: string; gender: string; imageUrl: string | null; rating?: number }`
  - `toPublicEntries(rows: SharedRow[], options: { scope: ShareScope; showRatings: boolean }): PublicEntry[]`
  - `shareOwnerLabel(nickname: string | null | undefined): string` (apodo o `'Una colección'`)

- [ ] **Step 1: Escribir `view.test.ts`:**
  - `parseShareScope('OWNED')` y `'WISHLIST'` válidos; `'owned'`, `'SAMPLED'`, `''`, `undefined` → `null`.
  - `toPublicEntries` con `scope: 'OWNED', showRatings: true` incluye `rating` solo en las filas que lo tienen (no agrega la clave si es `null`).
  - Con `showRatings: false` ninguna entrada tiene la clave `rating`.
  - Con `scope: 'WISHLIST', showRatings: true` ninguna entrada tiene `rating`.
  - Las entradas no contienen ninguna clave fuera de `id, brand, name, gender, imageUrl, rating` (usar `Object.keys`), aunque la fila de entrada traiga `personalNotes` y `email` extra.
  - `shareOwnerLabel('ana_perfumes') === 'ana_perfumes'`; `null`, `undefined` y `'  '` → `'Una colección'`.
- [ ] **Step 2: Correr y ver el fallo.** Run: `node --test src/lib/share/view.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `view.ts`.** Construir cada `PublicEntry` copiando campo por campo (no con `...spread`), para que un campo extra de la fila nunca llegue a la salida.
- [ ] **Step 4: Correr.** Run: `node --test src/lib/share/view.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** (con confirmación): `feat: vista pública de la colección compartida`.

### Task 3: Tabla `CollectionShare` (SQL, Prisma, respaldo)

**Files:**
- Create: `prisma/sql/2026-10-23-collection-share.sql`
- Modify: `prisma/schema.prisma` (enum `ShareScope`, modelo `CollectionShare`, relación `shares CollectionShare[]` en `User`)
- Modify: `scripts/backup-plan.ts:5-8` (agregar `'CollectionShare'` a `RESTORE_ORDER`, después de `'User'`, y a `USER_DATA_TABLES`)
- Modify: `docs/retencion-eliminacion-cuenta.md` (una línea: los links se borran en cascada con la cuenta)
- Test: `scripts/backup-plan.test.ts` (ajustar los casos que enumeran las tablas) y `scripts/collection-share-sql.test.ts` (integración)

**Interfaces:**
- Produces: modelo Prisma `collectionShare` con campos `id`, `userId`, `scope: ShareScope`, `showRatings: Boolean @default(false)`, `tokenHash: String @unique`, `createdAt`, e `@@unique([userId, scope])`.

- [ ] **Step 1: Escribir el SQL** siguiendo `prisma/sql/2026-10-12-user-nickname.sql` (transacción, comentario de respaldo previo, bloque de reversión): `CREATE TYPE "ShareScope" AS ENUM ('OWNED','WISHLIST')`; tabla con `FOREIGN KEY ... ON DELETE CASCADE`; índice único en `("userId","scope")`; índice único en `"tokenHash"`; `CHECK ("showRatings" = false OR "scope" = 'OWNED')`; `ALTER TABLE "CollectionShare" ENABLE ROW LEVEL SECURITY` (sin políticas, como el resto del esquema).
- [ ] **Step 2: Actualizar `schema.prisma`** con un comentario que remita al SQL (igual que `UserProfile.nickname`). Run: `npx prisma generate`. Expected: cliente regenerado sin errores.
- [ ] **Step 3: Ajustar `backup-plan.ts` y su test.** Run: `node --test scripts/backup-plan.test.ts`. Expected: PASS.
- [ ] **Step 4: Escribir `scripts/collection-share-sql.test.ts`** (mismo encabezado y `skip` que `scripts/private-perfumes-sql.test.ts`; crear dos usuarios de prueba y limpiarlos en `after`): rechaza un segundo link con el mismo `(userId, scope)`; rechaza `showRatings = true` con `scope = 'WISHLIST'`; rechaza `tokenHash` repetido; borrar el `User` borra sus links.
- [ ] **Step 5: Pedir a la persona que aplique el SQL** (respaldo previo con `npx tsx scripts/backup-db.ts`; luego ejecutar el archivo en Supabase). **No aplicarlo uno mismo.** Expected: confirmación de la persona.
- [ ] **Step 6: Correr la integración.** Run: `npx tsx --conditions=react-server --test scripts/collection-share-sql.test.ts`. Expected: PASS.
- [ ] **Step 7: Commit** (con confirmación): `feat: tabla CollectionShare para compartir colección`.

### Task 4: Acceso a datos (crear, revocar, listar, leer)

**Files:**
- Create: `src/lib/share/data.ts`
- Test: `scripts/collection-share-data.test.ts` (integración, mismo molde que Task 3)

**Interfaces:**
- Consumes: `generateShareToken`, `hashShareToken`, `isValidShareToken` (Task 1); `ShareScope`, `toPublicEntries`, `shareOwnerLabel`, `PublicEntry` (Task 2); modelo `collectionShare` (Task 3); `prisma` de `@/lib/prisma`.
- Produces:
  - `createOrReplaceShare(userId: string, scope: ShareScope, showRatings: boolean): Promise<{ token: string }>` (upsert por `userId_scope`; fuerza `showRatings = false` si `scope = 'WISHLIST'`)
  - `revokeShare(userId: string, scope: ShareScope): Promise<void>` (`deleteMany`, no falla si no existe)
  - `listShares(userId: string): Promise<{ scope: ShareScope; showRatings: boolean; createdAt: Date }[]>`
  - `getPublicShare(token: string): Promise<{ ownerLabel: string; scope: ShareScope; showRatings: boolean; entries: PublicEntry[] } | null>` (devuelve `null` sin consultar la base si `!isValidShareToken(token)`)

- [ ] **Step 1: Escribir las pruebas de integración** (usuarios y perfumes de prueba, limpieza en `after`):
  - `createOrReplaceShare` devuelve un token con el que `getPublicShare` encuentra las entradas `OWNED` y ninguna `WISHLIST`.
  - Regenerar el link invalida el token anterior (`getPublicShare(viejo) === null`) y el nuevo funciona.
  - `revokeShare` hace que `getPublicShare(token) === null`; llamarlo dos veces no lanza.
  - Pasar un perfume de `OWNED` a `SAMPLED` lo saca de la vista; un perfume `PRIVATE` de la misma persona nunca aparece; un `DRAFT` en `WISHLIST` tampoco.
  - Un `WISHLIST` creado con `showRatings = true` queda guardado como `false` y sin puntuaciones.
  - Una persona no ve ni revoca los links de otra (`listShares` solo devuelve los suyos).
  - Token con formato inválido → `null` y sin consulta (verificar con un token de 5000 caracteres).
  - Persona sin apodo → `ownerLabel === 'Una colección'`.
- [ ] **Step 2: Correr y ver el fallo.** Run: `npx tsx --conditions=react-server --test scripts/collection-share-data.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `data.ts`.** `getPublicShare` busca la fila por `tokenHash`, trae `UserCollection` con `status = scope` y `perfume.status = 'PUBLISHED'` seleccionando solo los campos de `SharedRow`, ordenado por marca y nombre, y el apodo desde `UserProfile`.
- [ ] **Step 4: Correr.** Mismo comando. Expected: PASS.
- [ ] **Step 5: Commit** (con confirmación): `feat: acceso a datos de colección compartida`.

### Task 5: Server Actions de gestión

**Files:**
- Create: `src/app/actions/share.ts`
- Test: `src/lib/share/form.test.ts` (parseo del formulario, puro) con `src/lib/share/form.ts`

**Interfaces:**
- Consumes: `createOrReplaceShare`, `revokeShare` (Task 4); `parseShareScope` (Task 2); `getAuthenticatedUserOrNull` de `@/lib/auth/require-user`; `limitAction`, `RATE_LIMIT_MESSAGE` de `@/lib/rate-limit`; `logServerError`.
- Produces:
  - `type ShareFormState = { status: 'idle' | 'success' | 'error'; message: string; token?: string }` (en `src/lib/share/form.ts`)
  - `shareInputFromFormData(formData: FormData): { scope: ShareScope; showRatings: boolean } | null`
  - `createShareAction(previous: ShareFormState, formData: FormData): Promise<ShareFormState>`
  - `revokeShareAction(previous: ShareFormState, formData: FormData): Promise<ShareFormState>`

- [ ] **Step 1: Escribir `form.test.ts`:** `scope` ausente o inválido → `null`; `showRatings` `'on'` → `true`, ausente → `false`; con `scope = 'WISHLIST'` y `showRatings` presente → `showRatings: false`.
- [ ] **Step 2: Correr y ver el fallo.** Run: `node --test src/lib/share/form.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `form.ts`.** Run de nuevo. Expected: PASS.
- [ ] **Step 4: Implementar `actions/share.ts`** con el patrón de `src/app/actions/collection.ts`: nunca lanzan, la persona sale de la sesión, rate-limit `limitAction('share', user.id, { limit: 10, windowMs: 60_000 })`, `logServerError('share/create' | 'share/revoke', error)`, `revalidatePath('/mi-coleccion')`. `createShareAction` devuelve `token` en el estado (única vez que sale en claro). Mensajes: «Link creado. Copialo ahora: no lo vas a poder ver de nuevo.» y «Dejaste de compartir esta lista.»
- [ ] **Step 5: Verificar tipos.** Run: `npx tsc --noEmit`. Expected: sin errores.
- [ ] **Step 6: Commit** (con confirmación): `feat: acciones para crear y revocar links de colección`.

### Task 6: Página pública `/c/[token]`

**Files:**
- Create: `src/app/c/[token]/page.tsx`
- Modify: `next.config.ts` (encabezado `Referrer-Policy: no-referrer` para `/c/:token*`)
- Modify: `src/app/globals.css` (bloque `/* === Colección compartida === */`, solo las clases nuevas; reutilizar `.perfume-card` y `PerfumeImage`)

**Interfaces:**
- Consumes: `getPublicShare` (Task 4); `rateLimit` y `clientIp` de `@/lib/rate-limit`; `PerfumeImage` de `src/app/perfumes/PerfumeImage.tsx`; `notFound` de `next/navigation`.

- [ ] **Step 1: Leer la guía de Next** en `node_modules/next/dist/docs/` sobre rutas dinámicas, `params` asíncronos, `headers()`, `notFound` y `metadata` (esta versión difiere de lo conocido; ver `web/AGENTS.md`).
- [ ] **Step 2: Implementar la página** (Server Component dinámico): limitar por IP a 30 por minuto con `rateLimit('share-view:' + clientIp(headers), …)` y, si se excede, mostrar un aviso «Demasiadas visitas seguidas. Probá de nuevo en un minuto.» (sin consultar la base); `getPublicShare(token)` → `notFound()` si es `null`; `metadata` con `robots: { index: false, follow: false }` y título «Colección de {ownerLabel}». Encabezado: «Lo que tiene {ownerLabel}» / «Lo que quiere {ownerLabel}». Tarjetas sin enlaces a la ficha ni acciones (`PerfumeImage` + marca + nombre + género + puntuación «★ n/5» solo si viene `rating`). Lista vacía: «Todavía no hay perfumes en esta lista.»
- [ ] **Step 3: Agregar el encabezado en `next.config.ts`** y los estilos mínimos (grilla de tarjetas compactas, probada a 375 px).
- [ ] **Step 4: Verificar.** Run: `npx tsc --noEmit && npx eslint src/app/c src/lib/share`. Expected: 0 errores.
- [ ] **Step 5: Probar en el navegador** (`npm run dev`) con un link creado desde la integración de Task 4: `/c/<token>` lista los perfumes; `/c/<token inválido>` da 404; `curl -sI` del link muestra `referrer-policy: no-referrer` y `<meta name="robots" content="noindex…">` en el HTML.
- [ ] **Step 6: Commit** (con confirmación): `feat: página pública de colección compartida`.

### Task 7: Bloque «Compartir» en `/mi-coleccion`

**Files:**
- Create: `src/app/mi-coleccion/SharePanel.tsx` (Client Component)
- Modify: `src/app/mi-coleccion/page.tsx` (cargar `listShares(user.id)` y renderizar el panel debajo de `CollectionView`, solo si la colección no está vacía)
- Modify: `src/app/globals.css` (bloque `/* === Compartir colección === */`)

**Interfaces:**
- Consumes: `createShareAction`, `revokeShareAction`, `ShareFormState` (Task 5); `listShares` (Task 4).
- Produces: `SharePanel({ shares }: { shares: { scope: ShareScope; showRatings: boolean; createdAt: string }[] })`.

- [ ] **Step 1: Implementar `SharePanel`** con `useActionState` (patrón de `DeleteEntryForm.tsx`): dos tarjetas (Lo tengo / Lo quiero); «Lo tengo» con casilla «Mostrar mis puntuaciones»; botón «Generar link» (o «Generar uno nuevo» si ya hay, con el aviso de que el anterior deja de funcionar); al recibir `token`, mostrar `location.origin + '/c/' + token` en un campo de solo lectura con botón «Copiar» (y «Compartir» si existe `navigator.share`); botón «Dejar de compartir» dentro de un `<details>` de confirmación como `DeleteEntryForm`. Aviso fijo: «El link muestra tu colección actual: si cambiás el estado de un perfume, pasa de una lista a otra.»
- [ ] **Step 2: Cablear en `page.tsx`.** Pasar `createdAt` como string ISO.
- [ ] **Step 3: Verificar.** Run: `npx tsc --noEmit && npx eslint src/app/mi-coleccion`. Expected: 0 errores.
- [ ] **Step 4: Probar con sesión real** (cuenta de prueba `TEST_EMAIL`/`TEST_PASSWORD`, `.env.local`): generar, copiar, abrir el link en una ventana sin sesión, regenerar (el viejo da 404), dejar de compartir. A 375 y 1280 px. Borrar los datos de prueba al terminar.
- [ ] **Step 5: Commit** (con confirmación): `feat: bloque Compartir en Mi colección`.

### Task 8: Smoke, accesibilidad y documentación

**Files:**
- Modify: `scripts/smoke-test.mjs` (comprobar que `/c/` + 43 caracteres válidos inexistentes responde 404 y que una ruta mal formada también)
- Create: `docs/compartir-coleccion.md`
- Modify: `web/PROGRESS.md` (entrada nueva arriba, con fecha y estado; ver feedback de mantener el archivo al día)

- [ ] **Step 1: Agregar los chequeos al smoke** siguiendo el estilo de las comprobaciones existentes. Run: `npm run smoke`. Expected: todas en verde.
- [ ] **Step 2: Accesibilidad de `/c/[token]`.** Con un token de prueba, correr `axe` según `docs/accesibilidad.md` (`npm run a11y` solo cubre rutas fijas). Expected: 0 incumplimientos.
- [ ] **Step 3: Escribir `docs/compartir-coleccion.md`:** qué es, privacidad (qué se muestra y qué no), modelo de token, cómo revocar, SQL y reversión, límites conocidos (rate-limit en memoria por instancia; el link reenviado sigue vivo hasta revocarlo).
- [ ] **Step 4: Verificación final.** Run: `node --test "src/**/*.test.ts" && npx tsc --noEmit && npx eslint && npm run build`. Expected: todo en verde.
- [ ] **Step 5: Actualizar `PROGRESS.md`** con lo hecho, lo verificado y lo pendiente (aplicar el SQL en producción antes de desplegar).
- [ ] **Step 6: Commit** (con confirmación): `docs: compartir colección por link`. El merge a `development` y a `main` se hace solo cuando la persona lo pida.
