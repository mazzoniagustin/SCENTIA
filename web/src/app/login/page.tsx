import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { requestMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

const errors: Record<string, string> = {
  email: "Ingresá un correo electrónico válido.",
  request: "No pudimos validar el origen de la solicitud. Volvé a intentarlo.",
  unavailable: "No pudimos enviar el enlace. Volvé a intentarlo más tarde.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/account");
  }

  const { error, sent } = await searchParams;

  return (
    <main className="auth-shell">
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
      <section aria-labelledby="login-title" className="auth-card">
        <p className="eyebrow">Tu colección, en privado</p>
        <h1 id="login-title">Ingresá con un enlace seguro</h1>
        <p>
          Te enviaremos un enlace de un solo uso. No almacenamos contraseñas en
          esta aplicación.
        </p>
        {sent === "1" ? (
          <p className="notice" role="status">
            Si el correo está habilitado, recibirás un enlace para ingresar.
          </p>
        ) : null}
        {error ? (
          <p className="error-message" role="alert">
            {errors[error] ?? "No pudimos completar la solicitud."}
          </p>
        ) : null}
        <form action={requestMagicLink} className="auth-form">
          <label htmlFor="email">Correo electrónico</label>
          <input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
          <button type="submit">Enviar enlace</button>
        </form>
      </section>
    </main>
  );
}
