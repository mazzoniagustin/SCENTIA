# Despliegue en Vercel + Supabase

Guía para publicar la aplicación (Hobby de Vercel y proyecto gratuito de Supabase, uso personal). Los nombres de los menús de Vercel y
Supabase pueden variar un poco con el tiempo. **Nunca pegues contraseñas ni claves en chats, issues ni archivos versionados.**

## 0. Estado de partida (ya verificado en local)
`npm run build` pasa; `tsc` y ESLint sin errores; 97 tests; auditoría de accesibilidad con 0 incumplimientos; prueba de humo 25/25 contra el
servidor de producción local; RLS activo en las 8 tablas; respaldo y restauración probados.

## 1. Preparar Supabase
1. **Contraseña de la base**: Project Settings → Database → *Reset database password*. Usá una larga y generada.
2. **Cadena de conexión**: botón **Connect** → pestaña *Transaction pooler* (puerto **6543**). Reemplazá `[YOUR-PASSWORD]` por la contraseña.
   Si tiene caracteres especiales (`@ : / ? # %`) hay que codificarlos en la URL (por ejemplo `@` → `%40`).
   - ⚠️ **No uses *Direct connection***: es solo IPv6, falla desde WSL/Windows sin IPv6 y desde Vercel (`ENETUNREACH`).
   - Para desarrollo local alcanza el *Session pooler* (puerto 5432).
3. **Auth → URL Configuration** (se completa después del paso 2.5, cuando sepas tu dominio): *Site URL* = `https://<tu-dominio>`;
   *Redirect URLs* = `https://<tu-dominio>/auth/confirm` y `http://localhost:3000/auth/confirm`. **Sin comodines** (`*`).
4. **Emails de acceso**: el SMTP incorporado de Supabase permite muy pocos emails por hora. Para más de unas pocas personas, Auth → SMTP
   Settings con un proveedor propio (Resend, Brevo, etc.).
5. **Registro e ingreso con contraseña** (`docs/cuenta-con-contrasena.md`): en Auth → Providers → Email dejá **Confirm email** activo y el
   largo mínimo de contraseña en **6**. En Auth → Email Templates, la plantilla **Confirm signup** tiene que llevar a
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (o conservar el enlace por defecto, que también vuelve a `/auth/confirm`).
   Las cuentas que ya existían (todas de enlace) eligen su contraseña en el próximo ingreso: no hace falta migrarlas.
6. Revocá la API key de Gemini en Google AI Studio: la app no la usa.

## 2. Crear el proyecto en Vercel
1. *Add New → Project* → importá el repositorio de GitHub.
2. **Root Directory**: `web` (la app vive en esa carpeta; el resto del repositorio es documentación y roles).
3. Framework: Next.js (se detecta solo). Install/Build: los de por defecto (`npm install` ejecuta `prisma generate` por el `postinstall`).
4. **Environment Variables** (marcá *Production* y *Preview*):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La cadena *Transaction pooler* (6543) del paso 1.2 |
| `NEXT_PUBLIC_SUPABASE_URL` | La de tu `.env.local` (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La de tu `.env.local` (clave *publishable*; es pública por diseño) |
| `SITE_URL` | `https://<tu-dominio>` sin barra final. **Obligatoria**: sin ella el enlace de acceso se rechaza en producción |
| `DATABASE_POOL_MAX` *(opcional)* | `5` por defecto |
| `SUPERADMIN_EMAILS` *(opcional)* | Tu correo (varios, separados por comas). Quien tenga la sesión de ese correo, ya confirmado, ve `/admin/auditoria`; para el resto la ruta da 404. Sin la variable nadie entra |
| `SUPABASE_SERVICE_ROLE_KEY` *(opcional)* | Solo si querés que al eliminar la cuenta también se borre la identidad de Auth. Es secreta: solo servidor |

5. *Deploy*. Con la primera URL (`https://<proyecto>.vercel.app`): cargala en `SITE_URL`, hacé *Redeploy* y completá el paso 1.3.
6. `vercel.json` ya fija la región de las funciones en **`pdx1`** (Oregon, junto a la base `us-west-2`: baja ~250 ms por consulta) y un cron diario
   a `/api/health` que evita que el proyecto gratuito de Supabase se pause por inactividad.

## 3. Verificar el despliegue
```bash
# desde web/, con la URL real (y las dos variables NEXT_PUBLIC_* en el entorno para incluir la prueba de RLS)
npm run smoke -- https://<tu-dominio>
```
Esperá *Todo OK*. Después, a mano: pedir el enlace de acceso con tu email, abrirlo y comprobar que vuelve a `https://<tu-dominio>/account`.
Y `npm run a11y -- https://<tu-dominio>`. Completá el checklist manual de `docs/accesibilidad.md`.

## 4. Operación

**Respaldo** (antes de cambios grandes y cada tanto): `npx tsx scripts/backup-db.ts --user-data` (solo personas, lo irreemplazable) o sin
flag para todo. Quedan en `backups/` (ignorada por git; contienen emails y notas privadas). Guardá una copia fuera de la máquina.

**Restaurar**: `npx tsx scripts/restore-db.ts backups/<carpeta> [--tables User,UserProfile]`. No destructivo (`ON CONFLICT DO NOTHING`).
Probado de punta a punta con `scripts/verify-backup-restore.ts`. El catálogo también se regenera con `scripts/import-fragrantica-batch.ts --all`.

**Cuentas eliminadas y respaldos**: al eliminar una cuenta se guarda un resumen anónimo (`DeletedAccountAudit`, ver `docs/retencion-eliminacion-cuenta.md`). Un respaldo anterior a la baja todavía contiene a la persona: **no restaures las tablas de usuarios (`User`, `UserCollection`, `UserProfile`, `WearLog`) de un respaldo viejo sobre cuentas ya eliminadas**. Si hubiera que hacerlo, volvé a aplicar después las bajas pedidas.

**Cambios de esquema**: `npx prisma db push` y, si se crean tablas, **volver a correr `npx tsx scripts/enable-rls.ts`** (las tablas nuevas nacen
con RLS desactivado y la clave pública permitiría leerlas y modificarlas).

**Volver atrás un despliegue**: Vercel → Deployments → el despliegue anterior → *Promote to Production* (o *Instant Rollback*).

**Rotar credenciales**: cambiar la contraseña en Supabase → actualizar `DATABASE_URL` en Vercel y en `.env.local` → *Redeploy*.

**Caché**: el listado público se sirve desde el CDN 60 s; las listas de acordes, los conteos y el ranking de similares se guardan en memoria
5–60 min por instancia. Un perfume publicado o despublicado puede tardar hasta ~10 minutos en reflejarse en todos lados.

**"¿Qué me pongo hoy?"** (opcional): la frase redactada por IA queda apagada salvo que cargues en Vercel `OUTFIT_LLM_ENABLED=true`, `GEMINI_API_KEY` (secreto, solo servidor, nunca `NEXT_PUBLIC_*`) y `GEMINI_MODEL`. Sin ellas se usa la frase de plantilla. Ver `docs/clima-que-me-pongo.md`.

## 5. Límites y costos a tener en cuenta
- Open-Meteo (clima): el uso gratuito es solo no comercial; si Scentia se monetiza hay que revisar sus términos o contratar el plan de pago.
- Vercel Hobby: uso personal y no comercial; límites de ejecución y de cron (1 por día). Supabase gratuito: se pausa tras ~una semana sin actividad
  (el cron lo evita) y no incluye respaldos automáticos descargables, por eso el script de respaldo.
- El limitador de tasa es por instancia (frena abuso casual). Para más protección, reglas del *Vercel Firewall*.
- La Content-Security-Policy está en modo bloqueante (`docs/seguridad-csp.md`). Tras desplegar, abrí la consola de DevTools y recorré el sitio con y sin sesión: si aparece `Refused to ...`, ver "Si algo se rompe" en ese documento.

## 6. Problemas frecuentes
| Síntoma | Causa probable |
|---|---|
| `ENETUNREACH` o la app no conecta a la base | Usaste *Direct connection*; usá el *Transaction pooler* |
| `password authentication failed` justo después de rotar la contraseña | Demora de propagación (≈ 1 minuto) o contraseña sin codificar en la URL |
| Al pedir el enlace de acceso vuelve a `/login?error=request` | Falta `SITE_URL` en Vercel |
| El enlace del email lleva a `localhost` o da error de redirección | Site URL / Redirect URLs de Supabase sin el dominio de producción |
| Error 500 en la primera visita tras una pausa | La base de Supabase estaba pausada: restaurarla desde el panel |
| `Prisma Client` no encontrado en el build | El `postinstall: prisma generate` no corrió; revisá que las variables estén cargadas para *Production* y *Preview* |
