import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="landing">
      <div className="landing-content">
        <p className="eyebrow">Catálogo editorial de perfumes</p>
        <h1>Elegí un perfume con más contexto.</h1>
        <p className="lead">
          La fundación de acceso está lista. Próximamente vas a poder descubrir,
          comparar y organizar tu colección privada.
        </p>
        <div className="landing-actions">
          <Link className="button" href={user ? "/account" : "/login"}>
            {user ? "Ver mi cuenta" : "Ingresar"}
          </Link>
          <Link className="button" href="/quiz">
            Descubrí tu perfil olfativo
          </Link>
        </div>
      </div>
    </main>
  );
}
