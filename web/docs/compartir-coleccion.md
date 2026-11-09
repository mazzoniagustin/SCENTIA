# Compartir la colección por link

## Qué es

Desde `/mi-coleccion`, el bloque «Compartir» permite generar un link público de solo lectura (`/c/<token>`) para una de las dos listas de
la persona: «Mis perfumes» (`OWNED`) o «Quiero» (`WISHLIST`). Hay un link por persona y por lista. Quien lo recibe ve la lista sin
iniciar sesión.

## Privacidad

Se muestra: marca, nombre, género, imagen del perfume y, solo en la lista de perfumes que la persona tiene y si ella lo activó, la
calificación. El encabezado usa el apodo si lo hay; si no, un texto neutro.

No se muestra nunca: el email, las notas personales, el estado de otras listas, ni los perfumes propios (`PRIVATE`). Solo se incluyen
perfumes `PUBLISHED`; los borradores y los privados quedan fuera aunque estén en la lista. La consulta pública selecciona únicamente
esos campos (ver `src/lib/share/data.ts`). Las calificaciones solo pueden mostrarse en `OWNED` (lo impone también un `CHECK` en la base).

## Modelo del token

- 32 bytes aleatorios en base64url (43 caracteres). Ver `src/lib/share/token.ts`.
- En la base se guarda solo el hash SHA-256 (`CollectionShare.tokenHash`); el token en claro no se guarda.
- El token se muestra una sola vez, al crearlo. Si se pierde, hay que regenerar.
- Regenerar crea un token nuevo y el anterior deja de funcionar de inmediato (una fila por persona y lista: `upsert`).
- Un token inexistente, mal formado o enorme responde 404 sin distinguir la causa.

## Cómo revocar

En «Compartir», botón de revocar de la lista correspondiente: borra la fila y el link responde 404 a partir de ese momento. También se
borran en cascada al eliminar la cuenta (ver `retencion-eliminacion-cuenta.md`).

## SQL

`prisma/sql/2026-10-23-collection-share.sql`: crea el tipo `ShareScope` y la tabla `CollectionShare` (índices únicos por
`(userId, scope)` y por `tokenHash`, FK con `ON DELETE CASCADE`, `CHECK` de calificaciones solo en `OWNED`, RLS habilitada sin políticas).
Es aditivo. Prisma no conoce el `CHECK`: se aplica a mano, dentro de una transacción y con respaldo previo (`npx tsx scripts/backup-db.ts`).
Aplicado el 2026-10-23.

Reversión (al final del mismo archivo):

```sql
BEGIN;
DROP TABLE "CollectionShare";
DROP TYPE "ShareScope";
COMMIT;
```

## Cabeceras y límites de uso

- `noindex` por cabecera `X-Robots-Tag` y por `<meta robots>` (`generateMetadata`).
- `Referrer-Policy: no-referrer` para `/c/:token*`, con override en `next.config.ts` (el resto del sitio mantiene su política);
  así el token no viaja en `Referer` hacia otros sitios.
- Limitador de la página: 30 solicitudes por minuto por IP, en memoria por instancia (en Vercel cada instancia lleva su propia cuenta).

## Límites conocidos

- Un link reenviado sigue vivo hasta que se revoque o regenere: no hay vencimiento automático.
- Al superar el límite de solicitudes, la página muestra un aviso con respuesta HTTP 200 (no 429).
- El limitador en memoria no se comparte entre instancias ni sobrevive a un reinicio.
- El bloque «Compartir» de `/mi-coleccion` requiere sesión; no tiene cobertura de navegador automatizada.

## Cómo se prueba

```bash
node --test "src/**/*.test.ts"                       # token, vista pública, formularios
npx tsx --conditions=react-server --test scripts/collection-share-sql.test.ts scripts/collection-share-data.test.ts   # contra la base real; crean y borran sus filas
npm run dev                                          # y en otra terminal:
npm run smoke -- http://localhost:3000               # /c/<token inexistente | mal formado | enorme> → 404
npm run a11y -- http://localhost:3000                # rutas fijas; /c/<token> requiere un link real (ver docs/accesibilidad.md)
curl -sI http://localhost:3000/c/<token> | grep -i referrer-policy; curl -s http://localhost:3000/c/<token> | grep -o "noindex"
```
