import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthSubmit } from "@/components/AuthSubmit";
import { CheckEmailPanel } from "@/components/CheckEmailPanel";
import { FocusFieldOnMount } from "@/components/FocusFieldOnMount";
import { FocusOnMount } from "@/components/FocusOnMount";
import { NICKNAME_ERRORS, NICKNAME_HINT, NICKNAME_MAX, NICKNAME_MIN } from "@/lib/account/nickname";
import { PASSWORD_ERRORS, PASSWORD_HINT, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";

import { requestSignupLink, signUpWithPasswordAction } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{ error?: string; sent?: string; metodo?: string; nickname?: string | string[] }>;
};

const errors: Record<string, string> = {
  ...NICKNAME_ERRORS,
  ...PASSWORD_ERRORS,
  email: "Ingresá un correo electrónico válido.",
  rate: "Hiciste muchos intentos. Esperá un minuto.",
  request: "No pudimos validar el origen de la solicitud. Volvé a intentarlo.",
  unavailable: "No pudimos completar el registro. Volvé a intentarlo más tarde.",
};

export const metadata = { title: "Crear cuenta" };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const { error, sent, metodo, nickname } = await searchParams;
  const byLink = metodo === "enlace";
  const nicknameError = error === "nickname" || error === "nickname-taken" || error === "nickname-reserved";
  const emailError = error === "email";
  const passwordError = typeof error === "string" && error.startsWith("password-");
  const fieldError = nicknameError || emailError || passwordError;
  const generalError = error && !fieldError ? error : null;
  const fallback = "No pudimos completar la solicitud.";
  // Solo se devuelve el apodo escrito (nunca el correo ni la contraseña), recortado por prolijidad.
  const typedNickname = (Array.isArray(nickname) ? nickname[0] : nickname)?.slice(0, 40) ?? "";
  const focusTarget = nicknameError ? "nickname" : passwordError ? "password" : "email";

  return (
    <main id="contenido" className="auth-shell">
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
      <section aria-labelledby="signup-title" className="auth-card">
        <p className="eyebrow">Tu colección, en privado</p>
        <h1 id="signup-title">Creá tu cuenta</h1>
        {sent === "1" ? (
          <CheckEmailPanel retryHref="/registro">
            <p>Revisá tu correo: te enviamos un enlace para confirmar tu cuenta y entrar.</p>
          </CheckEmailPanel>
        ) : (
          <>
            <p>
              {byLink
                ? "Te mandamos un enlace al correo. Al entrar vas a elegir tu contraseña."
                : "Elegí un correo y una contraseña. Te mandamos un enlace para confirmar tu cuenta."}
            </p>
            {generalError ? <FocusOnMount>{errors[generalError] ?? fallback}</FocusOnMount> : null}
            <form action={byLink ? requestSignupLink : signUpWithPasswordAction} className="auth-form">
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
              <label htmlFor="nickname">Apodo (opcional)</label>
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
                type="text"
              />
              {nicknameError ? (
                <p className="error-message" id="nickname-error" role="alert">
                  {errors[error as string]}
                </p>
              ) : null}
              <p className="form-hint" id="nickname-hint">
                {NICKNAME_HINT} Tu apodo es público; tu correo no. Si no elegís uno, te asignamos uno temporal.
              </p>
              {byLink ? null : (
                <>
                  <label htmlFor="password">Contraseña</label>
                  <input
                    aria-describedby={passwordError ? "password-error password-hint" : "password-hint"}
                    aria-invalid={passwordError ? "true" : undefined}
                    autoComplete="new-password"
                    id="password"
                    maxLength={PASSWORD_MAX}
                    minLength={PASSWORD_MIN}
                    name="password"
                    required
                    type="password"
                  />
                  {passwordError ? (
                    <p className="error-message" id="password-error" role="alert">
                      {errors[error as string]}
                    </p>
                  ) : null}
                  <p className="form-hint" id="password-hint">
                    {PASSWORD_HINT}
                  </p>
                </>
              )}
              {fieldError ? <FocusFieldOnMount targetId={focusTarget} /> : null}
              <AuthSubmit label={byLink ? "Enviarme un enlace" : "Crear cuenta"} />
            </form>
            <p>
              {byLink ? (
                <Link className="auth-link" href="/registro">
                  Prefiero crear la cuenta con contraseña
                </Link>
              ) : (
                <Link className="auth-link" href="/registro?metodo=enlace">
                  Prefiero recibir solo un enlace
                </Link>
              )}
            </p>
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
