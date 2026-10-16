import Link from "next/link";
import { redirect } from "next/navigation";

import { FocusOnMount } from "@/components/FocusOnMount";
import { NICKNAME_ERRORS, NICKNAME_HINT, NICKNAME_MAX, NICKNAME_MIN } from "@/lib/account/nickname";
import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { getUserProfile } from "@/lib/account/data";
import { LOCALES } from "@/lib/account/preferences";
import { PASSWORD_ERRORS, PASSWORD_HINT, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/password";
import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

import { changePasswordAction, deleteAccountAction, saveNicknameAction, savePreferencesAction } from "../actions/account";
import { signOut } from "../login/actions";

export const metadata = { title: "Mi cuenta" };

const LOCALE_LABELS: Record<string, string> = { es: "Español", en: "English" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) redirect("/login");

  const params = await searchParams;
  const profile = await getUserProfile(user.id);
  const preferences = profile?.preferences ?? { locale: "es", country: null, currency: null };

  const nicknameMissing = !profile?.nickname || profile.nicknameIsTemporary;
  const passwordChangeError = typeof params.error === "string" && (params.error in PASSWORD_ERRORS || params.error === "password-unavailable");
  const nicknameError = typeof params.error === "string" ? NICKNAME_ERRORS[params.error] : undefined;

  return (
    <main id="contenido" className="catalog account-page">
      <Link className="back-link" href="/">
        ← Inicio
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Sesión activa</p>
        <h1>Mi cuenta</h1>
        <p className="lead">{user.email}</p>
      </header>

      {params.saved === "preferences" && (
        <p className="notice" role="status">
          Preferencias guardadas.
        </p>
      )}
      {params.error === "preferences" && (
        <p className="error-message" role="alert">
          Revisá las preferencias: el país lleva 2 letras (AR) y la moneda 3 (ARS).
        </p>
      )}
      {params.error === "rate" && (
        <p className="error-message" role="alert">
          {RATE_LIMIT_MESSAGE}
        </p>
      )}
      {params.error === "confirm" && (
        <p className="error-message" role="alert">
          Para eliminar la cuenta escribí {DELETE_CONFIRMATION} en el campo de confirmación.
        </p>
      )}
      {params.error === "delete" && (
        <p className="error-message" role="alert">
          No pudimos eliminar tu cuenta ahora. No se borró nada: probá de nuevo en un rato.
        </p>
      )}

      <section className="ficha-section" aria-labelledby="acc-nickname">
        <h2 id="acc-nickname">Apodo</h2>
        {params.saved === "nickname" && (
          <p className="notice" role="status">
            Apodo guardado.
          </p>
        )}
        {nicknameError && <FocusOnMount>{nicknameError}</FocusOnMount>}
        {nicknameMissing && (
          <p className="notice" role="status">
            {profile?.nickname ? "Te asignamos un apodo temporal. Elegí uno propio." : "Todavía no tenés apodo. Elegí uno."}
          </p>
        )}
        <form className="account-form" action={saveNicknameAction}>
          <label htmlFor="nickname">Apodo (público)</label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            autoComplete="nickname"
            required
            minLength={NICKNAME_MIN}
            maxLength={NICKNAME_MAX}
            pattern="[A-Za-z0-9_\-]{3,20}"
            aria-describedby="nickname-hint"
            defaultValue={nicknameMissing ? "" : (profile?.nickname ?? "")}
          />
          <p className="form-hint" id="nickname-hint">
            {NICKNAME_HINT}
          </p>
          <div className="catalog-filters-actions">
            <button type="submit">Guardar apodo</button>
          </div>
        </form>
      </section>

      <section className="ficha-section" aria-labelledby="acc-prefs">
        <h2 id="acc-prefs">Preferencias</h2>
        <form className="account-form" action={savePreferencesAction}>
          <label>
            Idioma
            <select name="locale" defaultValue={preferences.locale}>
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_LABELS[locale] ?? locale}
                </option>
              ))}
            </select>
          </label>
          <label>
            País (2 letras, opcional)
            <input name="country" maxLength={2} placeholder="AR" defaultValue={preferences.country ?? ""} />
          </label>
          <label>
            Moneda (3 letras, opcional)
            <input name="currency" maxLength={3} placeholder="ARS" defaultValue={preferences.currency ?? ""} />
          </label>
          <div className="catalog-filters-actions">
            <button type="submit">Guardar preferencias</button>
          </div>
        </form>
      </section>

      <section className="ficha-section" aria-labelledby="acc-quiz">
        <h2 id="acc-quiz">Perfil olfativo</h2>
        {profile?.answers ? (
          <p>
            Tenés un perfil guardado. <Link href="/quiz">Ver o actualizar el quiz</Link>.
          </p>
        ) : (
          <p>
            Todavía no guardaste tu perfil. <Link href="/quiz">Hacer el quiz</Link>.
          </p>
        )}
      </section>

      <section className="ficha-section" aria-labelledby="acc-data">
        <h2 id="acc-data">Tus datos</h2>
        <p>
          Descargá una copia de lo que conservamos: tu cuenta, tus preferencias, tu perfil olfativo y tu colección con
          notas y puntuaciones.
        </p>
        <p>
          <a className="button" href="/api/account/export" download>
            Descargar mis datos (JSON)
          </a>
        </p>
      </section>

      <section className="ficha-section" aria-labelledby="acc-password">
        <h2 id="acc-password">Cambiar contraseña</h2>
        {params.password === "ok" && (
          <p className="notice" role="status">
            Listo, cambiamos tu contraseña.
          </p>
        )}
        {typeof params.error === "string" && (PASSWORD_ERRORS[params.error] || params.error === "password-unavailable") && (
          <p className="error-message" id="password-change-error" role="alert">
            {PASSWORD_ERRORS[params.error] ?? "No pudimos cambiar tu contraseña. Volvé a intentarlo."}
          </p>
        )}
        <form className="account-form" action={changePasswordAction}>
          <label>
            Contraseña actual
            <input name="current" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX} required aria-describedby={passwordChangeError ? "password-change-error" : undefined} aria-invalid={passwordChangeError ? "true" : undefined} />
          </label>
          <label>
            Contraseña nueva
            <input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required aria-describedby="password-change-hint" />
          </label>
          <label>
            Repetí la contraseña nueva
            <input name="repeat" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required aria-describedby="password-change-hint" />
          </label>
          <p className="form-hint" id="password-change-hint">{PASSWORD_HINT}</p>
          <div className="catalog-filters-actions">
            <button type="submit">Cambiar contraseña</button>
          </div>
        </form>
      </section>

      <section className="ficha-section account-danger" aria-labelledby="acc-delete">
        <h2 id="acc-delete">Eliminar cuenta</h2>
        <p>
          Borra tu colección, tus notas, tu perfil y tus preferencias. No se puede deshacer. Para confirmar, escribí{" "}
          <strong>{DELETE_CONFIRMATION}</strong>.
        </p>
        <p>
          Guardamos un resumen anónimo para estadística (cuántos perfumes tenías, cuántas valoraciones y tu racha más larga). No incluye
          tu correo, tu apodo ni tus notas, y no se puede relacionar con vos.
        </p>
        <form className="account-form" action={deleteAccountAction}>
          <label>
            Confirmación
            <input name="confirm" autoComplete="off" required aria-describedby="acc-delete" />
          </label>
          <div className="catalog-filters-actions">
            <button type="submit">Eliminar mi cuenta definitivamente</button>
          </div>
        </form>
      </section>

      <div className="account-actions">
        <form action={signOut}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
