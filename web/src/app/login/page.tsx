import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthSubmit } from "@/components/AuthSubmit";
import { BrandImage } from "@/components/BrandImage";
import { CheckEmailPanel } from "@/components/CheckEmailPanel";
import { FocusOnMount } from "@/components/FocusOnMount";
import { PASSWORD_MAX } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";

import { requestMagicLink, signInWithPasswordAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

const errors: Record<string, string> = {
  email: "Ingresá un correo electrónico válido.",
  credentials: "Correo o contraseña incorrectos.",
  confirmation: "El enlace venció o ya se usó. Pedí uno nuevo.",
  rate: "Hiciste muchos intentos. Esperá un minuto.",
  request: "No pudimos validar el origen de la solicitud. Volvé a intentarlo.",
  unavailable: "No pudimos completar la solicitud ahora. Volvé a intentarlo en un rato.",
};

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const { error, sent } = await searchParams;
  const fallback = "No pudimos completar la solicitud.";

  return (
    <main id="contenido" className="auth-shell">
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
      <section aria-labelledby="login-title" className="auth-card">
        <BrandImage slot="authMark" className="auth-mark" />
        <p className="eyebrow">Tu colección, en privado</p>
        <h1 id="login-title">Ingresar</h1>
        {sent === "1" ? (
          <CheckEmailPanel retryHref="/login">
            <p>
              Si tu correo está registrado, te enviamos un enlace. Si no,{" "}
              <Link className="auth-link" href="/registro">
                creá tu cuenta
              </Link>
              . Al entrar con el enlace vas a poder elegir una contraseña nueva.
            </p>
          </CheckEmailPanel>
        ) : (
          <>
            {error ? <FocusOnMount>{errors[error] ?? fallback}</FocusOnMount> : null}
            <form action={signInWithPasswordAction} className="auth-form">
              <label htmlFor="email">Correo electrónico</label>
              <input autoComplete="email" id="email" name="email" required type="email" />
              <label htmlFor="password">Contraseña</label>
              <input autoComplete="current-password" id="password" maxLength={PASSWORD_MAX} name="password" required type="password" />
              <AuthSubmit label="Ingresar" />
            </form>
            <h2>¿Olvidaste tu contraseña?</h2>
            <p>Te mandamos un enlace al correo; al entrar elegís una contraseña nueva.</p>
            <form action={requestMagicLink} className="auth-form">
              <label htmlFor="link-email">Correo electrónico para el enlace</label>
              <input autoComplete="email" id="link-email" name="email" required type="email" />
              <AuthSubmit label="Enviarme un enlace" />
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
