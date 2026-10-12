import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthSubmit } from "@/components/AuthSubmit";
import { CheckEmailPanel } from "@/components/CheckEmailPanel";
import { FocusFieldOnMount } from "@/components/FocusFieldOnMount";
import { FocusOnMount } from "@/components/FocusOnMount";
import { getCurrentUser } from "@/lib/auth/session";

import { requestMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

const errors: Record<string, string> = {
  email: "Ingresá un correo electrónico válido.",
  confirmation: "El enlace venció o ya se usó. Pedí uno nuevo.",
  rate: "Hiciste muchos intentos. Esperá un minuto.",
  request: "No pudimos validar el origen de la solicitud. Volvé a intentarlo.",
  unavailable: "No pudimos enviar el enlace. Volvé a intentarlo más tarde.",
};

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const { error, sent } = await searchParams;
  const emailError = error === "email";
  const generalError = error && !emailError ? error : null;
  const fallback = "No pudimos completar la solicitud.";

  return (
    <main id="contenido" className="auth-shell">
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
      <section aria-labelledby="login-title" className="auth-card">
        <p className="eyebrow">Tu colección, en privado</p>
        <h1 id="login-title">Ingresar</h1>
        <p>Sin contraseñas: te mandamos un enlace al correo</p>
        {sent === "1" ? (
          <CheckEmailPanel retryHref="/login">
            <p>
              Si tu correo está registrado, te enviamos un enlace. Si no,{" "}
              <Link className="auth-link" href="/registro">
                creá tu cuenta
              </Link>
              .
            </p>
          </CheckEmailPanel>
        ) : (
          <>
            {generalError ? <FocusOnMount>{errors[generalError] ?? fallback}</FocusOnMount> : null}
            <form action={requestMagicLink} className="auth-form">
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
                <>
                  <p className="error-message" id="email-error" role="alert">
                    {errors.email}
                  </p>
                  <FocusFieldOnMount targetId="email" />
                </>
              ) : null}
              <AuthSubmit label="Enviar enlace" />
            </form>
            <p>
              ¿No tenés cuenta?{" "}
              <Link className="auth-link" href="/registro">
                Crear cuenta
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
