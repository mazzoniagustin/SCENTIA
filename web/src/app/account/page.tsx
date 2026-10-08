import Link from "next/link";
import { redirect } from "next/navigation";

import { DELETE_CONFIRMATION } from "@/lib/account/constants";
import { getUserProfile } from "@/lib/account/data";
import { LOCALES } from "@/lib/account/preferences";
import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";

import { deleteAccountAction, savePreferencesAction } from "../actions/account";
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
      {params.error === "confirm" && (
        <p className="error-message" role="alert">
          Para eliminar la cuenta escribí {DELETE_CONFIRMATION} en el campo de confirmación.
        </p>
      )}

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

      <section className="ficha-section account-danger" aria-labelledby="acc-delete">
        <h2 id="acc-delete">Eliminar cuenta</h2>
        <p>
          Borra tu colección, tus notas, tu perfil y tus preferencias. No se puede deshacer. Para confirmar, escribí{" "}
          <strong>{DELETE_CONFIRMATION}</strong>.
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
