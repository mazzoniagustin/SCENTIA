import Link from "next/link";

import { filterBrands, groupByLetter } from "@/lib/brand-index";
import { getBrandIndex } from "@/lib/brands";
import { logServerError } from "@/lib/log";

export const metadata = { title: "Marcas" };

const MAX_QUERY = 60;
const POPULAR = 12;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const brandHref = (brand: string) => `/marcas/${encodeURIComponent(brand)}`;

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").slice(0, MAX_QUERY);

  let index: Awaited<ReturnType<typeof getBrandIndex>> = [];
  let failed = false;
  try {
    index = await getBrandIndex();
  } catch (error) {
    logServerError("marcas/page", error);
    failed = true;
  }

  const filtered = filterBrands(index, q);
  const groups = groupByLetter(filtered);
  const popular = q ? [] : [...index].sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand)).slice(0, POPULAR);

  return (
    <main id="contenido" className="catalog">
      <header className="catalog-header">
        <p className="eyebrow">Marcas</p>
        <h1>Explorá por marca</h1>
        {index.length > 0 && <p className="catalog-hint">{index.length.toLocaleString("es-AR")} marcas en el catálogo.</p>}
      </header>

      <form className="catalog-filter-bar" action="/marcas" method="GET">
        <div className="catalog-search">
          <input type="search" name="q" placeholder="Buscar una marca" aria-label="Buscar una marca" maxLength={MAX_QUERY} defaultValue={q} />
          <button type="submit">Buscar</button>
        </div>
      </form>

      {failed && (
        <p className="error-message" role="alert">
          No se pudieron cargar las marcas.
        </p>
      )}

      {popular.length > 0 && (
        <section className="home-section" aria-labelledby="brands-popular">
          <h2 id="brands-popular" className="brands-subtitle">
            Con más perfumes
          </h2>
          <ul className="home-accords">
            {popular.map(({ brand, count }) => (
              <li key={brand}>
                <Link href={brandHref(brand)}>
                  {brand}
                  <small>{count.toLocaleString("es-AR")}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length > 0 && (
        <nav className="brands-letters" aria-label="Ir a la letra">
          {groups.map(({ letter }) => (
            <a key={letter} href={`#letra-${letter === "#" ? "otros" : letter}`}>
              {letter}
            </a>
          ))}
        </nav>
      )}

      {!failed && filtered.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">No encontramos marcas con “{q}”.</p>
          <p>
            Probá con otra parte del nombre o <Link href="/marcas">mirá todas las marcas</Link>.
          </p>
        </div>
      ) : (
        groups.map(({ letter, brands }) => (
          <section key={letter} className="brands-group" aria-labelledby={`letra-${letter === "#" ? "otros" : letter}`}>
            <h2 id={`letra-${letter === "#" ? "otros" : letter}`}>{letter}</h2>
            <ul className="brands-list">
              {brands.map(({ brand, count }) => (
                <li key={brand}>
                  <Link href={brandHref(brand)}>
                    <span>{brand}</span>
                    <small>{count.toLocaleString("es-AR")}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
