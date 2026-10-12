import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthSubmit } from "@/components/AuthSubmit";
import { CheckEmailPanel } from "@/components/CheckEmailPanel";
import { FocusFieldOnMount } from "@/components/FocusFieldOnMount";
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
  const nicknameError = error === "nickname" || error === "nickname-taken" || error === "nickname-reserved";
  const emailError = error === "email";
  const fieldError = nicknameError || emailError;
  const generalError = error && !fieldError ? error : null;
  const fallback = "No pudimos completar la solicitud.";
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
        <p>Elegí un apodo y te mandamos un enlace al correo. Sin contraseñas.</p>
        {sent === "1" ? (
          <CheckEmailPanel retryHref="/registro">
            <p>Revisá tu correo: te enviamos un enlace para continuar.</p>
          </CheckEmailPanel>
        ) : (
          <>
            {generalError ? <FocusOnMount>{errors[generalError] ?? fallback}</FocusOnMount> : null}
            <form action={requestSignupLink} className="auth-form">
              <label htmlFor="email">Correo electrónico</label>
              <input
                aria-describedby={emailError ? "email-error" : undefined}
                aria-invalid={emailError ? "true" : undefined}
                autoComplete="email"
                id="email"
                name="email"
                required
                type="email"
              />
              {emailError ? (
                <p className="error-message" id="email-error" role="alert">
                  {errors.email}
                </p>
              ) : null}
              <label htmlFor="nickname">Apodo</label>
              <input
                aria-describedby={nicknameError ? "nickname-error nickname-hint" : "nickname-hint"}
                aria-invalid={nicknameError ? "true" : undefined}
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
              {nicknameError ? (
                <p className="error-message" id="nickname-error" role="alert">
                  {errors[error as string]}
                </p>
              ) : null}
              <p className="form-hint" id="nickname-hint">
                {NICKNAME_HINT} Tu apodo es público; tu correo no.
              </p>
              {fieldError ? <FocusFieldOnMount targetId={nicknameError ? "nickname" : "email"} /> : null}
              <AuthSubmit label="Crear cuenta" />
            </form>
            <p>
              ¿Ya tenés cuenta?{" "}
              <Link className="auth-link" href="/login">
                Ingresar
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
