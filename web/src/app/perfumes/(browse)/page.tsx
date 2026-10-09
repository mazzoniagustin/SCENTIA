import Link from "next/link";
import { PerfumeCard } from "../PerfumeCard";
import type { Perfume } from "../types";
import { logServerError } from "@/lib/log";
import { listPerfumes } from "@/lib/perfumes/list";
import { getAccordNames } from "@/lib/accord-stats";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserCollection } from "@/app/actions/collection";

type Pagination = { total: number; page: number; totalPages: number };

const SEASONS = ["primavera", "verano", "otoño", "invierno"] as const;
const OCCASIONS = [
  "diario",
  "trabajo",
  "cita",
  "formal",
  "deporte",
  "noche",
] as const;
const CONCENTRATIONS = ["parfum", "edp", "edt", "edc"] as const;
const GENDERS = ["femenino", "masculino", "unisex"] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Enlace a otra página conservando los filtros activos.
function pageHref(params: Record<string, string | string[] | undefined>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = first(value);
    if (single && key !== "page") query.set(key, single);
  }
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/perfumes?${qs}` : "/perfumes";
}

async function fetchPerfumes(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<{ perfumes: Perfume[]; pagination?: Pagination; error?: string }> {
  const query = new URLSearchParams();
  for (const key of [
    "q",
    "accord",
    "priceTier",
    "page",
    "brand",
    "concentration",
    "gender",
    "season",
    "occasion",
    "minDuration",
    "maxDuration",
    "minLongevity",
    "sort",
  ]) {
    const value = first(searchParams[key]);
    if (value) query.set(key, value);
  }

  try {
    const result = await listPerfumes(query);
    if (!result.ok) return { perfumes: [], error: result.error };
    const body = result.body as { data: Perfume[]; total: number; page: number; totalPages: number };
    return {
      perfumes: body.data,
      pagination: { total: body.total, page: body.page, totalPages: body.totalPages },
    };
  } catch (error) {
    logServerError("perfumes/page", error);
    return { perfumes: [], error: "No se pudo cargar el catálogo." };
  }
}

export const metadata = { title: "Catálogo" };

export default async function PerfumesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const [{ perfumes, pagination, error }, accordOptions] = await Promise.all([
    fetchPerfumes(params),
    getAccordNames(),
  ]);

  // Con las claims de la sesión alcanza (sin ida y vuelta a Supabase).
  const isAuthenticated = !!(await getCurrentUser());

  let collection: Awaited<ReturnType<typeof getUserCollection>> = [];
  if (isAuthenticated) {
    try {
      collection = await getUserCollection();
    } catch {
      // Ignore errors if collection fails
    }
  }

  const selected = {
    q: first(params.q) ?? "",
    accord: first(params.accord) ?? "",
    priceTier: first(params.priceTier) ?? "",
    brand: first(params.brand) ?? "",
    concentration: first(params.concentration) ?? "",
    gender: first(params.gender) ?? "",
    season: first(params.season) ?? "",
    occasion: first(params.occasion) ?? "",
    minDuration: first(params.minDuration) ?? "",
    minLongevity: first(params.minLongevity) ?? "",
    maxDuration: first(params.maxDuration) ?? "",
    sort: first(params.sort) ?? "",
  };

  const filtersActive = Object.values(selected).some(Boolean);
  // "Más filtros" arranca abierto si hay algún filtro aparte de la búsqueda.
  const moreActive = Object.entries(selected).some(([key, value]) => key !== "q" && Boolean(value));

  return (
    <main id="contenido" className="catalog">
      <header className="catalog-header">
        <p className="eyebrow">Catálogo</p>
        <h1>Perfumes</h1>
        {!isAuthenticated && (
          <p className="catalog-hint">
            <Link href="/login">Iniciá sesión</Link> para guardar perfumes en tu colección.
          </p>
        )}
      </header>

      {/* Filtros */}
      <form className="catalog-filter-bar" action="/perfumes" method="GET">
        <div className="catalog-search">
          <input
            type="search"
            name="q"
            placeholder="Buscar por nombre o marca"
            aria-label="Buscar por nombre o marca"
            defaultValue={selected.q}
          />
          <button type="submit">Buscar</button>
        </div>
        <details className="catalog-more" open={moreActive}>
          <summary>Más filtros</summary>
          <div className="catalog-filter-grid">
            <input type="text" name="brand" placeholder="Marca" aria-label="Marca" defaultValue={selected.brand} />
            <select name="accord" defaultValue={selected.accord} aria-label="Acorde">
              <option value="">Acorde</option>
              {accordOptions.map((name) => (
                <option key={name} value={name}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>
            <select name="priceTier" aria-label="Categoría" defaultValue={selected.priceTier}>
              <option value="">Todas las categorías</option>
              <option value="ARABIC">Árabe</option>
              <option value="DESIGNER">Diseñador</option>
              <option value="NICHE">Nicho</option>
            </select>
            <select name="concentration" aria-label="Concentración" defaultValue={selected.concentration}>
              <option value="">Concentración</option>
              {CONCENTRATIONS.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
            <select name="gender" aria-label="Género" defaultValue={selected.gender}>
              <option value="">Género</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </option>
              ))}
            </select>
            <select name="season" aria-label="Estación" defaultValue={selected.season}>
              <option value="">Estación</option>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <select name="occasion" aria-label="Ocasión" defaultValue={selected.occasion}>
              <option value="">Ocasión</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </option>
              ))}
            </select>
            <select name="sort" aria-label="Ordenar por" defaultValue={selected.sort}>
              <option value="">Ordenar por</option>
              <option value="relevance">Relevancia</option>
              <option value="newest">Más nuevos</option>
              <option value="longevity-desc">Mayor duración</option>
            </select>
            <select name="minLongevity" aria-label="Duración mínima" defaultValue={selected.minLongevity}>
              <option value="">Duración</option>
              <option value="3">Moderada o más</option>
              <option value="3.5">Larga o más</option>
              <option value="4">Muy larga</option>
            </select>
          </div>
          <div className="catalog-filters-actions">
            <button type="submit">Aplicar filtros</button>
            {filtersActive && <Link href="/perfumes">Limpiar</Link>}
          </div>
        </details>
      </form>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {perfumes.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">
            {error ? "No se pudo cargar el catálogo." : "No encontramos perfumes con esos filtros."}
          </p>
          {!error && (
            <p>
              Probá quitando alguno, o <Link href="/perfumes">volvé a ver todo el catálogo</Link>.
            </p>
          )}
        </div>
      ) : (
        <section aria-label={`Catálogo de perfumes, ${pagination?.total ?? perfumes.length} resultados`}>
          <p className="catalog-count">
            {(pagination?.total ?? perfumes.length).toLocaleString("es-AR")} perfumes
            {pagination && pagination.totalPages > 1 && ` · página ${pagination.page} de ${pagination.totalPages}`}
          </p>
          <ul className="catalog-grid">
            {perfumes.map((perfume) => {
              const entry = collection.find(c => c.perfumeId === perfume.id);
              return (
                <li key={perfume.id}>
                  <PerfumeCard perfume={perfume} collectionEntry={entry} isAuthenticated={isAuthenticated} />
                </li>
              );
            })}
          </ul>
          {pagination && pagination.totalPages > 1 && (
            <nav className="catalog-pagination" aria-label="Paginación">
              {pagination.page > 1 ? (
                <Link href={pageHref(params, pagination.page - 1)} rel="prev">
                  ← Anterior
                </Link>
              ) : (
                <span aria-disabled="true">← Anterior</span>
              )}
              <span>
                Página {pagination.page} de {pagination.totalPages}
              </span>
              {pagination.page < pagination.totalPages ? (
                <Link href={pageHref(params, pagination.page + 1)} rel="next">
                  Siguiente →
                </Link>
              ) : (
                <span aria-disabled="true">Siguiente →</span>
              )}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
