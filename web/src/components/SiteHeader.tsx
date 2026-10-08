import Link from "next/link";

// Cabecera estática (sin sesión): "Cuenta" lleva a /account, que redirige a /login si hace falta.
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-wordmark" href="/">
        Scentia
      </Link>
      <nav className="site-nav" aria-label="Principal">
        <Link href="/perfumes">Catálogo</Link>
        <Link href="/quiz">Quiz olfativo</Link>
        <Link href="/mi-coleccion">Mi colección</Link>
        <Link href="/account">Cuenta</Link>
      </nav>
    </header>
  );
}
