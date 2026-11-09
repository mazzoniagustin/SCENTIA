# Cuenta con contraseña (registro, ingreso, contraseña obligatoria y cambio)

Estado: **implementado el 2026-10-16**, sin commitear al escribir esto. Verificado: 595 tests, `tsc`, ESLint, build, smoke 30/30 y `npm run a11y` con
0 incumplimientos en 19 páginas. **Sin verificar con Supabase real** (registro con confirmación, enlace sin contraseña → pantalla obligatoria sin bucle,
ingreso, cambio y recuperación vía enlace): ver "Pruebas".

Cambios respecto del diseño (a raíz de la revisión independiente):
- **Recuperar una contraseña olvidada**: el diseño original no funcionaba (con la marca puesta, el enlace no llevaba a ninguna parte y el cambio pide la actual).
  Ahora "¿Olvidaste tu contraseña?" deja una cookie `httpOnly` de 1 hora; `/auth/confirm` la consume y lleva a `/elegir-contrasena`, donde se puede fijar una
  contraseña nueva **sin la actual solo si la sesión nació de un enlace del correo hace menos de 15 minutos** (claim `amr` del token: `otp`, `magiclink` o
  `recovery`). Con la contraseña ya puesta, la pantalla ofrece "Mantener mi contraseña actual".
- `choosePasswordAction` ya no cambia la contraseña de una sesión que tiene la suya y no viene de un enlace reciente (antes bastaba tener sesión).
- Límite conocido: pedir la contraseña actual en `/account` es una barrera de interfaz; Supabase acepta `updateUser({ password })` con solo el token, salvo que
  "Secure password change" esté activo en Auth. Activarlo exigiría reautenticar a las sesiones de más de 24 h en `/elegir-contrasena` (hoy se vería "unavailable").
- El ingreso distingue 429 y errores 5xx de Supabase ("No pudimos completar la solicitud…") de credenciales inválidas, y registra el código (sin el correo).
- `same_password` tras un refresco fallido se trata como éxito y se refresca igual.
- Otros ajustes: se verifica la actual con el correo de Supabase Auth, y se mejoró `aria-describedby`/`aria-invalid` en `/elegir-contrasena` y `/account`.

Cambios menores: `/login` muestra los errores en un solo aviso arriba (no por campo); en el modo enlace de `/registro`, un error
redirige a `/registro` sin `?metodo=enlace` (se ve el formulario con contraseña con el mensaje de error).

## Objetivo

Hoy el acceso es solo por enlace al correo (magic link) y el apodo es obligatorio al registrarse. Se agrega:

1. **Registro con correo, apodo (opcional) y contraseña** (mínimo 6 caracteres), con confirmación del correo antes de poder usar Scentia.
2. **Ingreso con correo y contraseña**, manteniendo el enlace como alternativa y como recuperación de contraseña olvidada.
3. **Contraseña obligatoria para quien entra por enlace y no tiene una**, incluidas las cuentas actuales.
4. **Cambio de contraseña** desde `/account`.

## Decisiones (de la persona propietaria)

- El correo **se confirma** antes de entrar (requiere "Confirm email" activo en Supabase).
- El apodo es **opcional** tanto en el registro con contraseña como en el registro por enlace; sin apodo se usa el temporal que ya existe.
- Quien entra por enlace y no tiene contraseña debe elegir una antes de seguir; también las cuentas actuales (todas de enlace).
- El enlace sirve para recuperar una contraseña olvidada (no hay flujo aparte de "olvidé mi contraseña"); ver "Cambios respecto del diseño".

## Marca de "tiene contraseña"

- `user_metadata.password_set === true` en Supabase Auth; se escribe con `updateUser({ password, data: { password_set: true } })` o, en el registro,
  en los metadatos de `signUp`. Sin marca = debe elegir contraseña. No hay cambio de esquema ni SQL.
- Supabase no revela si una cuenta tiene contraseña, por eso se usa esta marca. La puede alterar la propia persona desde el navegador: solo
  le permitiría saltarse la pantalla obligatoria, sin ningún otro privilegio (es una regla de producto, no de seguridad).

## Dónde se exige: `src/proxy.ts`

- Para toda persona con sesión sin la marca, las páginas redirigen a `/elegir-contrasena`. Se lee de los claims del token (`getClaims`), sin consultas extra.
- Excepciones: `/elegir-contrasena`, `/auth/*`, cerrar sesión y archivos estáticos. Las rutas `/api/*` no redirigen (responden como hasta ahora).
- Decisión pura y testeable: `needsPasswordSetup({ hasSession, passwordSet, pathname }): boolean`.
- Tras fijar la contraseña la acción hace `refreshSession()` para que el token traiga la marca; si no, la persona quedaría en un bucle. Se verifica a mano.

## Pantallas

- **`/registro`**: formulario principal con correo, apodo (opcional), contraseña (`autocomplete="new-password"`, mínimo 6) → `signUp` con
  `emailRedirectTo` a `/auth/confirm` y `data: { nickname?, password_set: true }`. Mensaje "Revisá tu correo" igual para un correo nuevo o
  ya registrado. Enlace secundario "Prefiero recibir solo un enlace" (`/registro?metodo=enlace`) con el formulario actual (apodo opcional).
- **`/login`**: correo + contraseña (`signInWithPassword`); error genérico "Correo o contraseña incorrectos" (no distingue correo
  inexistente de contraseña errónea). Debajo, el formulario de enlace actual.
- **`/elegir-contrasena`** (con sesión): contraseña y repetirla, mínimo 6 → `updateUser` + `refreshSession` → `/account`. El destino de vuelta solo
  admite rutas internas.
- **`/account` → "Cambiar contraseña"**: contraseña actual, nueva y repetir. La actual se verifica con `signInWithPassword` antes de cambiar
  (con límite de intentos); la nueva debe diferir de la actual. Una cuenta sin marca no llega acá (el proxy la manda a `/elegir-contrasena`).

## Seguridad

- Límite de intentos por IP en registro e ingreso (reutiliza `src/lib/rate-limit.ts`); el cambio de contraseña usa el límite por persona de las acciones de cuenta.
- La contraseña nunca va en la URL, en logs ni en respuestas; el correo no se repite en URLs (como hoy).
- Sin enumeración de correos: registro y login responden igual para correos existentes o no.
- Validación en el servidor (largo 6-72 caracteres; 72 por el límite de bcrypt de Supabase), además del `minlength` del navegador.
- Los mensajes de error son genéricos; el detalle va a `logServerError` sin datos personales.

## Estructura de código

- `src/lib/auth/password.ts` (puro): `validatePassword`, `validatePasswordChange`.
- `src/lib/auth/password-auth.ts` (núcleo con dependencias inyectadas, como `magic-link.ts`): `signUpWithPassword`, `signInWithPasswordCore`; devuelven la ruta de redirección.
- `src/lib/auth/password-gate.ts` (puro): `needsPasswordSetup`.
- Acciones de servidor en `src/app/registro/`, `src/app/login/`, `src/app/elegir-contrasena/` y `src/app/actions/account.ts`; cada una arma las dependencias reales.
- `src/lib/auth/magic-link.ts`: apodo opcional en modo `signup`.

## Pruebas

- `node --test`: validación de contraseña (5 vs 6, 72 vs 73, vacío, espacios), núcleo de registro e ingreso (apodo opcional, apodo tomado, límite de
  intentos, respuesta sin revelar correos), `needsPasswordSetup` (con y sin marca, rutas excluidas, `/api`), cambio de contraseña (actual errónea, igual a la actual).
- `npm run a11y` sobre `/registro`, `/login` y `/elegir-contrasena` (con `A11Y_COOKIE` para las privadas); prueba de humo ampliada.
- A mano con Supabase real (no automatizable acá): registro + confirmación + entrada, enlace sin contraseña → pantalla obligatoria → sin bucle,
  ingreso con contraseña, cambio de contraseña, contraseña olvidada vía enlace.

## Configuración de Supabase (la hace la persona propietaria)

"Confirm email" activo; largo mínimo de contraseña 6; plantilla "Confirm signup" apuntando a `/auth/confirm` con el token; Redirect URLs sin comodines.

## Fuera de alcance

- Flujo propio de "olvidé mi contraseña" (lo cubre el enlace), contraseñas filtradas (requiere plan de pago de Supabase), segundo factor, eliminación de cuenta con contraseña.
- Migrar o avisar por correo a las cuentas actuales: se les pide la contraseña en su próximo ingreso.
