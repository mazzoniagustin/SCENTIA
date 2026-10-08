import Link from "next/link";
import { CompareCheckbox } from "./CompareCheckbox";
import { CollectionForm } from "./CollectionForm";
import { CompareBar } from "./CompareBar";
import { Perfume, PRICE_TIER_LABELS } from "./types";
import { logServerError } from "@/lib/log";
import { listPerfumes } from "@/lib/perfumes/list";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
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

function Card({ perfume, collectionEntry, isAuthenticated }: { perfume: Perfume; collectionEntry?: { status: string; rating?: number | null; personalNotes?: string | null }; isAuthenticated: boolean }) {
  const priceTierLabel = perfume.priceTier ? PRICE_TIER_LABELS[perfume.priceTier] : null;

  return (
    <article className="perfume-card">
      <p className="perfume-brand">{perfume.brand}</p>
      <h2 className="perfume-name">
        <Link href={`/perfumes/${perfume.id}`}>{perfume.name}</Link>
      </h2>
      <p className="perfume-meta">
        {[perfume.concentration?.toUpperCase(), perfume.releaseYear]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {priceTierLabel && (
        <ul className="perfume-badges" aria-label="Categoría">
          <li>{priceTierLabel}</li>
        </ul>
      )}
      {perfume.seasons.length > 0 && (
        <ul className="perfume-badges" aria-label="Estaciones">
          {perfume.seasons.map((season) => (
            <li key={season}>{season}</li>
          ))}
        </ul>
      )}
      {perfume.occasions.length > 0 && (
        <ul className="perfume-badges" aria-label="Ocasiones">
          {perfume.occasions.map((occasion) => (
            <li key={occasion}>{occasion}</li>
          ))}
        </ul>
      )}
      <CompareCheckbox perfumeId={perfume.id} perfumeName={perfume.name} />

      {isAuthenticated ? (
        collectionEntry ? (
          <CollectionForm perfumeId={perfume.id} initialData={collectionEntry} />
        ) : (
          <CollectionForm perfumeId={perfume.id} />
        )
      ) : (
        <Link href="/login" className="text-sm text-gray-500">Iniciá sesión para añadir a tu colección</Link>
      )}
    </article>
  );
}

export default async function PerfumesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const [{ perfumes, pagination, error }, accordOptions] = await Promise.all([
    fetchPerfumes(params),
    prisma.accord.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  // Check auth
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthenticated = !!data.user;

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
    maxDuration: first(params.maxDuration) ?? "",
    sort: first(params.sort) ?? "",
  };

  const filtersActive = Object.values(selected).some(Boolean);

  return (
    <main className="catalog">
      <CompareBar />
      <Link className="back-link" href="/">
        ← Inicio
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Catálogo</p>
        <h1>Perfumes</h1>
      </header>

      {/* Filtros */}
      <form className="catalog-filters" action="/perfumes" method="GET">
        <input
          type="search"
          name="q"
          placeholder="Buscar por nombre o marca"
          aria-label="Buscar por nombre o marca"
          defaultValue={selected.q}
        />
        <input type="text" name="brand" placeholder="Marca" defaultValue={selected.brand} />
        <select name="accord" defaultValue={selected.accord} aria-label="Acorde">
          <option value="">Acorde</option>
          {accordOptions.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name.charAt(0).toUpperCase() + a.name.slice(1)}
            </option>
          ))}
        </select>
        <select name="priceTier" defaultValue={selected.priceTier}>
          <option value="">Todas las categorías</option>
          <option value="ARABIC">Árabe</option>
          <option value="DESIGNER">Diseñador</option>
          <option value="NICHE">Nicho</option>
        </select>
        <select name="concentration" defaultValue={selected.concentration}>
          <option value="">Concentración</option>
          {CONCENTRATIONS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
        <select name="gender" defaultValue={selected.gender}>
          <option value="">Género</option>
          {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
        </select>
        <select name="season" defaultValue={selected.season}>
          <option value="">Estación</option>
          {SEASONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select name="occasion" defaultValue={selected.occasion}>
          <option value="">Ocasión</option>
          {OCCASIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
        <fieldset className="duration-fieldset">
          <legend>Duración</legend>
          <input type="number" name="minDuration" placeholder="Min" defaultValue={selected.minDuration} />
          <input type="number" name="maxDuration" placeholder="Max" defaultValue={selected.maxDuration} />
        </fieldset>
        <select name="sort" defaultValue={selected.sort}>
          <option value="">Ordenar por</option>
          <option value="relevance">Relevancia</option>
          <option value="newest">Más nuevos</option>
          <option value="duration-desc">Mayor duración</option>
          <option value="duration-asc">Menor duración</option>
        </select>
        <div className="catalog-filters-actions">
          <button type="submit">Filtrar</button>
          {filtersActive && <Link href="/perfumes">Limpiar</Link>}
        </div>
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
                  <Card perfume={perfume} collectionEntry={entry} isAuthenticated={isAuthenticated} />
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
