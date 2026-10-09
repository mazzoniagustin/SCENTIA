import Link from "next/link";

export const metadata = { title: "No encontramos esa página" };

// Página 404 propia: va dentro del layout raíz (idioma, enlace de salto) y en español.
export default function NotFound() {
  return (
    <main id="contenido" className="catalog" data-page="not-found">
      <header className="catalog-header">
        <p className="eyebrow">Error 404</p>
        <h1>No encontramos esa página</h1>
        <p className="lead">Puede que el perfume ya no esté publicado o que el enlace sea incorrecto.</p>
      </header>
      <p>
        <Link className="button" href="/perfumes">
          Ir al catálogo
        </Link>
      </p>
    </main>
  );
}
