import Link from "next/link";

import { filterBrands, groupByLetter, letterParam, parseLetter } from "@/lib/brand-index";
import { getBrandIndex } from "@/lib/brands";
import { logServerError } from "@/lib/log";

export const metadata = { title: "Marcas" };

const MAX_QUERY = 60;
const POPULAR = 12;
/** Con una búsqueda se muestran como mucho tantas marcas: la lista completa pesaba más de 120.000 px en el celular. */
const MAX_RESULTS = 200;

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

  // Sin búsqueda se muestra una letra por vez (?letra=A): antes se listaban las 2.681 marcas en una sola página.
  const allGroups = groupByLetter(index);
  const letter = parseLetter(first(params.letra));
  const currentGroup = letter ? allGroups.find((g) => g.letter === letter) : undefined;
  const matches = filterBrands(index, q);
  const shown = matches.slice(0, MAX_RESULTS);
  const groups = q ? groupByLetter(shown) : currentGroup ? [currentGroup] : [];
  const popular = q || currentGroup ? [] : [...index].sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand)).slice(0, POPULAR);

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

      {allGroups.length > 0 && !q && (
        <nav className="brands-letters" aria-label="Marcas por letra">
          {allGroups.map((g) => (
            <Link
              key={g.letter}
              href={`/marcas?letra=${letterParam(g.letter)}`}
              aria-current={g.letter === currentGroup?.letter ? "page" : undefined}
              title={`${g.brands.length.toLocaleString("es-AR")} marcas`}
            >
              {g.letter}
            </Link>
          ))}
        </nav>
      )}

      {!failed && q && matches.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">No encontramos marcas con “{q}”.</p>
          <p>
            Probá con otra parte del nombre o <Link href="/marcas">mirá todas las marcas</Link>.
          </p>
        </div>
      ) : (
        groups.map(({ letter: groupLetter, brands }) => (
          <section key={groupLetter} className="brands-group" aria-labelledby={`letra-${letterParam(groupLetter)}`}>
            <h2 id={`letra-${letterParam(groupLetter)}`}>{groupLetter}</h2>
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
      {q && matches.length > MAX_RESULTS && (
        <p className="catalog-hint">
          Mostrando {MAX_RESULTS} de {matches.length.toLocaleString("es-AR")} marcas. Escribí más del nombre para afinar la búsqueda.
        </p>
      )}

      {!failed && !q && !currentGroup && allGroups.length > 0 && (
        <p className="catalog-hint">
          {letter ? "No hay marcas con esa letra. " : ""}Elegí una letra para ver sus marcas, o buscá por nombre.
        </p>
      )}
    </main>
  );
}
