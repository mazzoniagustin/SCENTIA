import Link from "next/link";
import { redirect } from "next/navigation";

import { FocusOnMount } from "@/components/FocusOnMount";
import { NICKNAME_ERRORS, NICKNAME_HINT, NICKNAME_MAX, NICKNAME_MIN } from "@/lib/account/nickname";
import { getCurrentUser } from "@/lib/auth/session";

import { requestSignupLink } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{ error?: string; sent?: string; nickname?: string | string[] }>;
};

const errors: Record<string, string> = {
  ...NICKNAME_ERRORS,
  email: "Ingresá un correo electrónico válido.",
  rate: "Hiciste muchos intentos. Esperá un minuto.",
  request: "No pudimos validar el origen de la solicitud. Volvé a intentarlo.",
  unavailable: "No pudimos enviar el enlace. Volvé a intentarlo más tarde.",
};

export const metadata = { title: "Crear cuenta" };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const { error, sent, nickname } = await searchParams;
  // Solo se devuelve el apodo escrito (nunca el correo), recortado por prolijidad.
  const typedNickname = (Array.isArray(nickname) ? nickname[0] : nickname)?.slice(0, 40) ?? "";

  return (
    <main id="contenido" className="auth-shell">
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
      <section aria-labelledby="signup-title" className="auth-card">
        <p className="eyebrow">Tu colección, en privado</p>
        <h1 id="signup-title">Creá tu cuenta</h1>
        <p>
          Elegí un apodo y te enviaremos un enlace de un solo uso. No almacenamos contraseñas en esta aplicación.
        </p>
        {sent === "1" ? (
          <p className="notice" role="status">
            Revisá tu correo: te enviamos un enlace para continuar.
          </p>
        ) : null}
        {error ? (
          <FocusOnMount>{errors[error] ?? "No pudimos completar la solicitud."}</FocusOnMount>
        ) : null}
        <form action={requestSignupLink} className="auth-form">
          <label htmlFor="email">Correo electrónico</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
          <label htmlFor="nickname">Apodo</label>
          <input
            aria-describedby="nickname-hint"
            autoComplete="nickname"
            defaultValue={typedNickname}
            id="nickname"
            maxLength={NICKNAME_MAX}
            minLength={NICKNAME_MIN}
            name="nickname"
            pattern="[A-Za-z0-9_\-]{3,20}"
            required
            type="text"
          />
          <p className="form-hint" id="nickname-hint">
            {NICKNAME_HINT} Tu apodo es público; tu correo no.
          </p>
          <button type="submit">Crear cuenta</button>
        </form>
        <p>
          ¿Ya tenés cuenta? <Link href="/login">Ingresá</Link>
        </p>
      </section>
    </main>
  );
}
