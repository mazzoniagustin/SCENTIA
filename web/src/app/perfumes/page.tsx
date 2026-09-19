import Link from "next/link";
import { headers } from "next/headers";
import { CompareCheckbox } from "./CompareCheckbox";
import { CollectionForm } from "./CollectionForm";
import { CompareBar } from "./CompareBar";
import { Perfume } from "./types";
import { createClient } from "@/lib/supabase/server";
import { getUserCollection } from "@/app/actions/collection";

type PerfumesResponse =
  | { data: Perfume[]; count: number }
  | { error: string };

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

const DURATION_STEPS = [4, 6, 8, 10, 12] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function fetchPerfumes(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<{ perfumes: Perfume[]; error?: string }> {
  const query = new URLSearchParams();
  for (const key of [
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

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const apiUrl = new URL(`/api/perfumes?${query.toString()}`, `${protocol}://${host ?? "localhost:3000"}`);

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
    });
    const body = (await response.json()) as PerfumesResponse;
    if (!response.ok || !("data" in body)) {
      const message = "error" in body ? body.error : `Error ${response.status}`;
      return { perfumes: [], error: message };
    }
    return { perfumes: body.data };
  } catch {
    return { perfumes: [], error: "No se pudo cargar el catálogo." };
  }
}

function Card({ perfume, collectionEntry, isAuthenticated }: { perfume: Perfume; collectionEntry?: any; isAuthenticated: boolean }) {
  const priceTierLabel = {
    ARABIC: 'Árabe',
    DESIGNER: 'Diseñador',
    NICHE: 'Nicho'
  }[perfume.priceTier || ''];

  return (
    <article className="perfume-card">
      <p className="perfume-brand">{perfume.brand}</p>
      <h2 className="perfume-name">{perfume.name}</h2>
      <p className="perfume-meta">
        {perfume.concentration.toUpperCase()}
        {perfume.releaseYear ? ` · ${perfume.releaseYear}` : ""}
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
  const { perfumes, error } = await fetchPerfumes(params);

  // Check auth
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthenticated = !!data.user;

  let collection: any[] = [];
  if (isAuthenticated) {
    try {
      collection = await getUserCollection();
    } catch {
      // Ignore errors if collection fails
    }
  }

  const selected = {
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
        <input type="text" name="brand" placeholder="Marca" defaultValue={selected.brand} />
        <select name="priceTier" defaultValue={first(params.priceTier) ?? ""}>
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
        <section aria-label={`Catálogo de perfumes, ${perfumes.length} resultados`}>
          <p className="catalog-count">{perfumes.length} perfumes</p>
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
        </section>
      )}
    </main>
  );
}
