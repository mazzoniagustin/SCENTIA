import Link from "next/link";
import { redirect } from "next/navigation";

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

  return (
    <main id="contenido" className="auth-shell">
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
            Si tu correo está registrado, te enviamos un link. Si no,{" "}
            <Link href="/registro">creá tu cuenta</Link>.
          </p>
        ) : null}
        {error ? (
          <FocusOnMount>{errors[error] ?? "No pudimos completar la solicitud."}</FocusOnMount>
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
        <p>
          ¿No tenés cuenta? <Link href="/registro">Crear cuenta</Link>
        </p>
      </section>
    </main>
  );
}
