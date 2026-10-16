import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthSubmit } from "@/components/AuthSubmit";
import { FocusOnMount } from "@/components/FocusOnMount";
import { signOut } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { PASSWORD_ERRORS, PASSWORD_HINT, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/password";

import { choosePasswordAction } from "./actions";

type ChoosePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errors: Record<string, string> = {
  ...PASSWORD_ERRORS,
  rate: "Hiciste muchos intentos. Esperá un minuto.",
  unavailable: "No pudimos guardar tu contraseña. Volvé a intentarlo.",
};

export const metadata = { title: "Elegí tu contraseña" };

export default async function ChoosePasswordPage({ searchParams }: ChoosePasswordPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.canChoosePassword) redirect("/account");

  const { error } = await searchParams;
  const message = error ? (errors[error] ?? "No pudimos completar la solicitud.") : null;

  return (
    <main id="contenido" className="auth-shell">
      <section aria-labelledby="choose-title" className="auth-card">
        <p className="eyebrow">Un último paso</p>
        <h1 id="choose-title">Elegí tu contraseña</h1>
        <p>
          {user.passwordSet
            ? "Entraste con un enlace. Si olvidaste tu contraseña, elegí una nueva ahora."
            : "Para seguir usando Scentia necesitás una contraseña. Con ella vas a poder ingresar sin esperar un enlace por correo."}
        </p>
        {message ? <FocusOnMount id="choose-error">{message}</FocusOnMount> : null}
        <form action={choosePasswordAction} className="auth-form">
          <label htmlFor="password">Contraseña</label>
          <input
            aria-describedby={message ? "choose-error password-hint" : "password-hint"}
            aria-invalid={message ? "true" : undefined}
            autoComplete="new-password"
            id="password"
            maxLength={PASSWORD_MAX}
            minLength={PASSWORD_MIN}
            name="password"
            required
            type="password"
          />
          <p className="form-hint" id="password-hint">
            {PASSWORD_HINT}
          </p>
          <label htmlFor="repeat">Repetí la contraseña</label>
          <input
            aria-describedby="password-hint"
            autoComplete="new-password"
            id="repeat"
            maxLength={PASSWORD_MAX}
            minLength={PASSWORD_MIN}
            name="repeat"
            required
            type="password"
          />
          <AuthSubmit label="Guardar contraseña" />
        </form>
        {user.passwordSet ? (
          <p>
            <Link className="auth-link" href="/account">
              Mantener mi contraseña actual
            </Link>
          </p>
        ) : null}
        <form action={signOut}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </section>
    </main>
  );
}
