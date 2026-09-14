import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { signOut } from "../login/actions";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="auth-shell">
      <section aria-labelledby="account-title" className="auth-card">
        <p className="eyebrow">Sesión activa</p>
        <h1 id="account-title">Tu cuenta está conectada</h1>
        <p>
          La colección privada se habilitará cuando exista su modelo de datos y
          sus políticas RLS.
        </p>
        <div className="account-actions">
          <Link href="/">Ir al inicio</Link>
          <form action={signOut}>
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      </section>
    </main>
  );
}
