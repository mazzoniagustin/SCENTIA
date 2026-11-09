# Retención al eliminar una cuenta (RF-05)

Estado: **implementado el 2026-10-16**, sin commitear al momento de escribir esto. SQL aplicado a la base real con respaldo previo
(`backups/2026-10-16T18-51-58-503Z-usuarios`); verificado con `scripts/verify-account-deletion.ts` (6 comprobaciones).

Cambios respecto del diseño: `deleteUserData(userId, options?)` recibe un parámetro opcional `afterArchive`, solo como punto de
inserción para probar la atomicidad (la acción de la cuenta no lo usa). Los scripts de verificación borran los resúmenes que
generan sus usuarios de prueba.

Ajustes tras la revisión independiente (2026-10-16):
- El id de `DeletedAccountAudit` es un **UUID v4** (`@default(uuid(4))`), no un cuid: un cuid v1 lleva la hora exacta de creación y habría
  revelado la de la baja. El SQL no cambia (la columna es `TEXT` sin default).
- Las filas anónimas se insertan con `createMany` (un solo INSERT) y la transacción tiene `timeout` de 20 s; verificado con una
  colección de 400 perfumes.
- `deleteAccountAction` ya no crea usuarios (`getExistingUserOrNull`): un doble envío no genera un segundo resumen vacío. Si la
  eliminación falla, se registra con `logServerError` y la persona vuelve a `/account?error=delete` con un mensaje genérico.
- Límite conocido: mientras falte `SUPABASE_SERVICE_ROLE_KEY` la identidad de Auth sigue viva; si la persona vuelve a entrar se crea una
  cuenta nueva y, si la elimina, se guarda otro resumen (cuenta nueva = resumen nuevo).
- Los scripts de verificación borran "los resúmenes que no existían al empezar": si una persona real elimina su cuenta justo mientras
  corren, esa prueba podría borrar su resumen. Correrlos con poca actividad.

## Objetivo

Hoy `deleteUserData` (`src/lib/account/data.ts`) borra la fila `User` y la cascada se lleva colección, perfil y racha: no queda
rastro de que la cuenta existió. La persona propietaria quiere conservar **estadística anónima** para contar cuentas
registradas (activas + eliminadas), perfumes en colección y uso, sin conservar datos personales.

Los links para compartir la colección (`CollectionShare`) también se borran en cascada con la cuenta.

## Qué se conserva y qué no

| Se conserva (sin forma de identificar a la persona) | No se guarda nunca |
|---|---|
| Que la cuenta existió y se eliminó: mes de alta y mes de baja (`YYYY-MM`) | Correo, nombre, apodo, `supabaseId`, id original (`User.id`) |
| Cuántos perfumes tenía, en total y por estado | `personalNotes` (texto libre) |
| Qué perfumes (`perfumeId`) con su estado y `rating` | Respuestas del quiz, país, idioma, moneda |
| Cantidad de valoraciones y su suma | Fechas exactas (día u hora) |
| Racha más larga y total de días registrados | |
| Si tenía perfil del quiz (sí/no) | |
| Versión de la política de retención | |

Decisión de la persona propietaria: el riesgo de reidentificación por información externa se considera inexistente; no se agrupa
más ni se recortan filas.

## Datos: dos tablas nuevas (aditivo)

- `DeletedAccountAudit`: `id` (cuid nuevo, **distinto** de `User.id`), `signedUpMonth`, `deletedMonth`, `collectionTotal`,
  conteos por estado (`OWNED`, `SAMPLED`, `WISHLIST`, `DISLIKED`), `ratingsCount`, `ratingsSum`, `longestStreak`,
  `wearDaysTotal`, `hadQuizProfile`, `policyVersion`.
- `DeletedAccountCollection`: `auditId` (FK con `ON DELETE CASCADE`), `perfumeId`, `status`, `rating`. Sin FK a `Perfume`: si
  un perfume se elimina del catálogo, el registro histórico no debe perderse ni bloquear el borrado.
- RLS activado y **sin políticas**: solo el servidor (rol de la aplicación) las usa; nunca se exponen por la API de Supabase.
- Se aplican con un SQL revisado en `prisma/sql/` (como `2026-10-12-user-nickname.sql`), con **confirmación explícita** antes
  de ejecutarlo. Reversión: `DROP TABLE "DeletedAccountCollection", "DeletedAccountAudit"`.

## Flujo de eliminación

1. `deleteUserData(userId)` abre **una transacción**.
2. Lee `User.createdAt`, la colección, los registros de racha y si hay perfil con respuestas del quiz.
3. `buildDeletionSummary(...)` (función pura) calcula el resumen; reutiliza `summarizeStreak` de `src/lib/streak/streak.ts`
   para la racha más larga y redondea las fechas a mes.
4. Inserta `DeletedAccountAudit` y las filas de `DeletedAccountCollection`.
5. Borra el `User` (la cascada actual hace el resto).
6. Si cualquier paso falla, **no se borra nada** y la acción devuelve un error genérico para que la persona reintente; el detalle
   va al log del servidor (`logServerError`).
7. Después de la transacción se elimina la identidad de Supabase Auth, como hoy. Eso sigue dependiendo de
   `SUPABASE_SERVICE_ROLE_KEY` (pendiente aparte, no cambia con este diseño).

La exportación (`exportUserData`) solo incluye datos de cuentas vivas e incluye `shares` (lista, si muestra puntuaciones y fecha de cada link; nunca el hash del token).

## Interfaz

La sección "Eliminar cuenta" de `/account` agrega una línea que aclara que se conserva un resumen anónimo (sin correo, notas ni
nada que permita identificarte). Texto exacto a definir al implementar, en español rioplatense como el resto.

## Respaldos

Los respaldos de `scripts/backup-db.ts` incluyen datos de usuarios. Una cuenta eliminada puede reaparecer si se restaura un respaldo
anterior a la baja. La política queda escrita: **no restaurar tablas de usuarios sobre cuentas eliminadas**; si se restaura un
respaldo viejo, hay que volver a aplicar las bajas registradas.

## Retención

El archivo anónimo no vence: al no contener datos identificables, no hay fecha límite de borrado. Si en el futuro se agregara
algún campo identificable, habría que revisar esta decisión.

## Pruebas y verificación

- Tests unitarios de `buildDeletionSummary`: colección vacía, sin racha, sin valoraciones, todos los estados, fechas a mes, ausencia
  de campos personales en el resultado.
- `scripts/verify-account-deletion.ts` contra la base real, con un usuario de prueba que se crea y se elimina (mismo patrón que
  `verify-account-data.ts`):
  - queda el registro, sin correo, notas ni id original;
  - las filas anónimas coinciden con la colección real;
  - el resto de los datos de la persona se borró;
  - si falla el insert del registro, el usuario sigue existiendo;
  - otra persona no se ve afectada.
- `tsc`, ESLint y la suite de tests en verde.

## Fuera de alcance

- Interfaz o consultas para ver las estadísticas (por ahora se consultan con SQL).
- Eliminación de la identidad de Auth sin `SUPABASE_SERVICE_ROLE_KEY`.
- Otros pendientes de seguridad (CSP bloqueante, rol de base con permisos mínimos).
