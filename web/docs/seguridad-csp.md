# Content-Security-Policy (modo bloqueante)

Estado (2026-10-16): la política se envía como `Content-Security-Policy` y **bloquea** lo que no cumpla. Antes estuvo en `Content-Security-Policy-Report-Only`.

**Cómo se verificó el cambio:** `next build` (todas las rutas son dinámicas `ƒ`, así que todas reciben nonce); con el servidor de producción local, las 13 rutas públicas devuelven la cabecera y cada `<script>` y `<style>` lleva el nonce de su pedido, sin manejadores `on*` en línea ni `<noscript><style>`; las privadas redirigen a `/login` con la cabecera; smoke 30/30. **No se probó en un navegador** (en el entorno de desarrollo faltan librerías del sistema para Chromium): hay que mirar la consola de DevTools en Vercel, con y sin sesión (ver "Si algo se rompe").

## Dónde vive

- `src/lib/security/csp.ts`: `buildCsp({ nonce, isDev, supabaseUrl })`, función pura con tests en `csp.test.ts`. `CSP_HEADER_NAME` define el nombre del encabezado.
- `src/proxy.ts`: genera un nonce por request (`crypto.randomUUID` en base64), pone `x-nonce` y el encabezado CSP en la request (Next lee ahí el nonce y lo aplica a sus scripts y estilos) y en la response. Usa la misma respuesta que devuelve `updateSession`, así que las cookies de sesión de Supabase se conservan.
- El matcher mantiene la exclusión de estáticos y suma `missing` para los prefetch de `next/link` (`next-router-prefetch` y `purpose: prefetch`).

## Política (producción)

```
default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'nonce-<n>'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob: https://fimgs.net; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'
```

En desarrollo se suma `'unsafe-eval'` a `script-src`. `upgrade-insecure-requests` se agrega porque el proxy pasa `enforce: true` (solo en producción). Efecto en local: con `next start` sobre `http://localhost` el navegador puede intentar cargar los recursos por https; para probar en local usar `next dev` (isDev la omite).

Decisiones:
- `style-src-attr 'unsafe-inline'`: se aceptan los `style={{}}` de React (los nonces no cubren atributos).
- `img-src` deriva de `ALLOWED_IMAGE_HOSTS` (`src/lib/images.ts`).
- Desde el 2026-10-21 `src/proxy.ts` pasa `NEXT_PUBLIC_SUPABASE_URL` a `buildCsp`: su origen se suma a `img-src` (fotos firmadas de perfumes propios)
  y a `connect-src` (subida directa a Storage). Ver `docs/perfumes-propios.md`.
- `connect-src 'self'`: `src/lib/supabase/client.ts` (`createBrowserClient`) hoy no lo importa nadie; solo el servidor habla con Supabase. Si algún componente de cliente lo usa, pasar `supabaseUrl` a `buildCsp` en el proxy.
- `fonts`: `next/font/google` se autoalberga en el build (`font-src 'self'`), sin pedidos a Google.

## Notas sobre posibles violaciones

- `<noscript><style>` de `SiteNav` y `QuizWizard`: ya se movieron a `@media (scripting: none)` en `globals.css`; no quedan estilos en línea sin nonce.
- `<img>` de `src/app/perfumes/PerfumeImage.tsx`: cubierto por `img-src` (`https://fimgs.net`). Una imagen de otro host quedaría bloqueada: agregarlo a `ALLOWED_IMAGE_HOSTS` (`src/lib/images.ts`).
- Scripts en línea de Next (bootstrap, datos RSC): llevan nonce porque todas las rutas son dinámicas. Una ruta estática (○) nueva quedaría sin nonce y **se rompería**: mantenerlas dinámicas (p. ej. `await connection()`) o revisar el `next build`.
- No hay JSON-LD, `dangerouslySetInnerHTML` ni `<script>` propios en `src/`.

## Cómo probar

No hay endpoint de reportes. Con Playwright (también sirve con la política bloqueante: el evento se dispara igual), escuchar el evento y la consola:

```ts
await page.addInitScript(() => {
  (window as any).__csp = [];
  document.addEventListener('securitypolicyviolation', (e) =>
    (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
// navegar por las rutas clave, con y sin sesión, y leer window.__csp
```

Esperado: ninguna violación en rutas dinámicas, salvo las de `<noscript>` (que no se ejecutan con JS activo). Verificar también que `Content-Security-Policy-Report-Only` figure en la response y que las cookies `sb-*` sigan seteándose al iniciar sesión.

## Si algo se rompe (volver a solo informar)

Síntomas: página sin estilos, botones que no responden o imágenes que faltan, con errores `Refused to ...` en la consola. Para volver atrás sin tocar nada más: en `src/lib/security/csp.ts` poner `CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only'` (y el test `usa el modo bloqueante`) y quitar `enforce: true` en `src/proxy.ts`. Después, mirar en la consola la directiva y el origen que se bloquearon y corregir la política.

Pruebas manuales pendientes en Vercel (con la consola de DevTools abierta): ingresar, registrarse, `/mi-coleccion` (rollo y "Mostrar más"), `/que-me-pongo` (geolocalización y buscar ciudad), el quiz con y sin JavaScript, cambiar contraseña y cerrar sesión.

## Geolocalización ("¿Qué me pongo hoy?")

`Permissions-Policy` pasó de `geolocation=()` a `geolocation=(self)` (en `next.config.ts`): solo nuestro origen puede pedir la ubicación y únicamente al tocar un botón. Las coordenadas se redondean a 1 decimal en el navegador y viajan en el cuerpo de un POST; el servidor consulta Open-Meteo, por eso `connect-src` sigue en `'self'` y `csp.ts` no cambia.
