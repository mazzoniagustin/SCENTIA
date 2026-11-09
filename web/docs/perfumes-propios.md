# Perfumes propios en la colección

Cada persona puede agregar a su colección un perfume que tiene y no está en el catálogo. Es **privado**: no entra al catálogo, a las
marcas, al quiz ni a las recomendaciones, y solo lo ve su dueño. Participa en la racha, en los huecos de la colección y en
"¿Qué me pongo hoy?" (estos dos últimos, solo si tiene al menos un acorde).

## Modelo de datos

- Se reutiliza `Perfume` con `status = PRIVATE` y `ownerId` (FK a `User`, `ON DELETE CASCADE`: al borrar la cuenta se borran el perfume,
  sus acordes, su colección y su racha). Casi todo el catálogo ya filtra `status = 'PUBLISHED'`, así que los privados quedan ocultos.
- Columnas nuevas: `ownerId`, `topNotes`, `heartNotes`, `baseNotes` (listas de texto; no usan la tabla global `Note`).
- `imageUrl` guarda la **ruta** de la foto en Storage (`{supabaseId}/{uuid}.webp`), no una URL.
- La duración (1-5) y la estela (1-4) se guardan en `longevity` y `sillage`, que son las columnas que leen los motores.
- Los acordes los elige la persona entre los existentes (0-6, intensidad fija 70, `OWN_ACCORD_INTENSITY`).
- Unicidad: `(brand, name)` único solo para el catálogo (`ownerId IS NULL`) y `(ownerId, lower(brand), lower(name))` por persona.
  Prisma no modela índices parciales: viven en `prisma/sql/2026-10-21-private-perfumes.sql`. **No usar `db push` sobre `Perfume`
  sin revisar ese archivo.** El schema ya no declara `@@unique([brand, name])`; el cliente de Prisma no tiene `brand_name`.
- Sin tope de cantidad por persona (decisión del 2026-10-21): solo rigen el límite de frecuencia (30 escrituras/min) y el tamaño de foto.

## Fotos (Supabase Storage)

- Bucket privado `private-perfumes` (WebP, hasta 300 KB, `prisma/sql/2026-10-21-private-perfumes-storage.sql`), **sin políticas** sobre
  `storage.objects`: todo pasa por el servidor (subida con token, lectura con URL firmada, borrado con la clave de servicio). Si la base se
  creó con la primera versión de ese archivo, aplicar también `2026-10-21-private-perfumes-storage-lock.sql` (quita las 4 políticas). Su cuota es
  independiente de los 500 MB de la base. La carpeta es el **id de Supabase** de la persona (`auth.uid()`), no el cuid de `User`.
- En el navegador (`src/lib/private-perfumes/photo-upload.ts`) la foto se achica a 800 px y se convierte a WebP; se sube directo a Storage
  con un token de un solo uso que entrega `requestPhotoUploadAction` (no pasa por las funciones de Vercel).
- Al guardar, el servidor verifica que la ruta sea de la persona, que el archivo exista y que pese menos de 300 KB.
- Para mostrar se firman URLs de 1 hora (`displayImageUrls`); la CSP permite el origen de Supabase en `img-src` y `connect-src`
  (`src/proxy.ts` pasa `NEXT_PUBLIC_SUPABASE_URL`).
- **Necesita `SUPABASE_SERVICE_ROLE_KEY`** (solo servidor, `.env.local` y variables de Vercel). Sin ella la página de alta muestra que la
  función no está disponible y el borrado de cuenta sigue funcionando pero deja un aviso y las fotos huérfanas.
- Fotos huérfanas: si alguien sube una foto y no guarda el formulario, el archivo queda en su carpeta (ocupa cuota, no expone nada).
  No hay limpieza automática mientras la cuenta existe; al **eliminar la cuenta** se borra toda la carpeta (`removeAllPhotosOf`), también lo no
  guardado. Se puede vaciar una carpeta a mano desde el panel de Storage.

## Integración con los motores

| Función | Qué hace con un perfume propio |
| --- | --- |
| Racha (`wear/data.ts`) | Aparece en las opciones; sin cambios de lógica (no filtra por publicación). |
| Huecos (`gaps/data.ts → getCollectionSamples`) | Cuenta solo si tiene acordes. Las estadísticas y candidatos del catálogo siguen en `PUBLISHED`. |
| ¿Qué me pongo? (`outfit/data.ts`) | Candidato solo con acordes; `own: true` y foto firmada. |
| Frase con Gemini | Marca y nombre **no** salen hacia el proveedor (`marca: propia`, `perfume: propio`): son texto libre de la persona. |
| `accord-stats` y auditoría de admin | Excluyen `ownerId` no nulo (no distorsionan el IDF y admin no ve lo que escribe cada persona). |
| Scripts de catálogo | Filtran `ownerId: null` (importaciones, editorial, país, estaciones). |
| Exportación de cuenta | Suma `ownPerfumes` (sin la ruta interna de la foto). |
| Borrado de cuenta | Lista las rutas antes, borra la fila (cascada) y después toda la carpeta de fotos de Storage. |
| Respaldo (`scripts/backup-db.ts --user-data`) | Incluye los perfumes propios (`Perfume` con `ownerId`) y sus acordes; `restore-db.ts` restaura `User` antes que `Perfume`. |
| Pantallas que mezclan catálogo y propios | `perfumeHref` (ficha privada vs. pública) y `brandAndName`/`nameOfBrand`/`brandInParens` (la marca puede ser `''`) en `src/lib/private-perfumes/display.ts`. |

`assertCollectable` (`collection/data.ts`) impide guardar en la propia colección el perfume privado de otra persona.

## Pantallas

`/mi-coleccion/nuevo` (alta), `/mi-coleccion/[id]` (ficha, 404 para quien no es el dueño), `/mi-coleccion/[id]/editar`. En Mi colección,
la tarjeta lleva la etiqueta "Propio" y su borrado elimina el perfume entero (con confirmación), no solo la entrada de colección.

## Reversión

Los dos SQL traen su reversión comentada. Para el principal hay que borrar antes los perfumes con `ownerId` no nulo. El valor `PRIVATE`
del enum no se puede quitar. Respaldo previo del 2026-10-21: `backups/2026-10-21T01-46-55-820Z`.

## Pendientes conocidos (Minor, revisión del 2026-10-21)

- `photoExists` se llama antes de validar la ruta con `isOwnPhotoPath`; una misma ruta de foto puede asignarse a dos perfumes de la misma persona;
  `deleteCollectionEntry*` puede quitar de la colección un perfume propio sin borrarlo (los tres, solo con una petición armada a mano).
- El total de la auditoría de admin cuenta ids de perfumes propios de cuentas ya eliminadas (páginas vacías al final).
- Los scripts `verify-account-deletion`, `verify-account-data` y `verify-backup-restore` toman un perfume cualquiera sin filtrar `ownerId`.
- Un nombre de solo caracteres invisibles (U+200B, U+3164, U+2800) pasa el mínimo de 2.
- El servidor no verifica el contenido de la foto, solo tamaño y existencia.

## Verificación (2026-10-21)

- `node --test "src/**/*.test.ts"`: 685 pruebas en verde (incluye `src/lib/private-perfumes/`, outfit, CSP).
- Contra la base real (`npx tsx --conditions=react-server --test <archivo>`): `scripts/private-perfumes-sql.test.ts` (6),
  `private-perfumes-data.test.ts` (10), `private-perfumes-engines.test.ts` (8); `scripts/gaps-sql.test.ts` (7) sigue en verde.
- `npx tsx --conditions=react-server scripts/verify-private-perfumes-storage.ts`: ciclo completo de la foto contra Supabase real.
- `tsc` limpio (ignorando `claude-office/`, carpeta local fuera del repo que rompe `npm run build` si no se excluye), ESLint sin errores en
  lo tocado, `npm run build` OK (excluyendo `claude-office/` temporalmente), smoke 39/40 y `npm run a11y` 0 en 19 páginas públicas.
- **No verificado (requiere sesión real y navegador):** el flujo completo de alta con foto desde el navegador (achicado con canvas,
  subida con token, redirección), la edición y el borrado desde la interfaz, el aspecto de las pantallas nuevas (Chromium no arranca
  en este entorno) y la accesibilidad de las páginas privadas (`A11Y_COOKIE`).
- El smoke tiene 1 falla previa ajena a esta función: `/account` sin sesión redirige a `/auth/expired` y la prueba espera `/login`.
