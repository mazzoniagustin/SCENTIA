# Auditoría para el superadmin

Página `/admin/auditoria`: números agregados de las cuentas y de las colecciones, para llevar el conteo de cuentas registradas, eliminadas y perfumes guardados.

## Quién entra
- Se define con la variable de entorno `SUPERADMIN_EMAILS` (solo servidor): correos separados por comas, sin distinguir mayúsculas. Sin la variable, o vacía, **nadie** entra.
- Hace falta sesión de Supabase con ese correo **confirmado** (`getUser()`, no solo el token). Código: `src/lib/admin/superadmin.ts` (puro, con tests) y `src/lib/auth/superadmin.ts`.
- Para cualquier otra persona, o sin sesión, la ruta responde **404** (no revela que existe), con `noindex`. El smoke lo comprueba.
- Quien es superadmin ve un aviso con el enlace en `/account`. No hay enlace en el menú público.
- Agregar o quitar superadmins = cambiar la variable en Vercel y redesplegar. No hay rol en la base (decisión: para una sola persona evita una migración).

## Qué muestra (solo lectura)
- **Cuentas:** activas, eliminadas, registradas en total y bajas sobre el total.
- **Altas y bajas por mes**, sin huecos. Las altas suman las cuentas activas por mes de alta y las eliminadas por su mes de alta (`DeletedAccountAudit.signedUpMonth`).
- **Perfumes en colecciones** por estado, cuentas activas contra eliminadas, con perfumes por cuenta y valoración promedio.
- **Actividad:** perfiles de quiz, días con perfume registrados, racha más larga y promedio de las eliminadas.
- **Perfumes más guardados** (10), contando colecciones activas y eliminadas.
- **Todos los guardados** (`/admin/auditoria/guardados`): todos los perfumes distintos que están en alguna colección (activa o eliminada), de más a menos guardados, con el desglose por estado (lo tengo, probé, deseado, descartado), de a 50 por página (`?page=`). Solo conteos por perfume.

## Qué nunca muestra
Correos, nombres, apodos, ids de personas, notas privadas ni el quiz. Los datos salen de consultas de agregación (`src/lib/admin/audit-data.ts`); las cuentas eliminadas aportan solo su resumen anónimo (`docs/retencion-eliminacion-cuenta.md`). Con pocas cuentas, el "más guardados" puede reflejar la colección de una sola persona: es un dato agregado, pero tenelo en cuenta antes de compartir capturas.

## Cálculos
`src/lib/admin/audit-report.ts` (puro, con tests): promedios y porcentajes que devuelven `null` sin datos (se muestra "—"), línea de tiempo continua, totales por estado.
