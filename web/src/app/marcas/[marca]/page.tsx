import Link from "next/link";
import { notFound } from "next/navigation";

import { getUserCollection } from "@/app/actions/collection";
import { PerfumeCard } from "@/app/perfumes/PerfumeCard";
import type { Perfume } from "@/app/perfumes/types";
import { getBrandSummary, resolveBrand } from "@/lib/brands";
import { logServerError } from "@/lib/log";
import { listPerfumes } from "@/lib/perfumes/list";
import { getCurrentUser } from "@/lib/auth/session";

const PAGE_SIZE = 24;
const GENDER_PLURAL: Record<string, string> = { femenino: "para mujeres", masculino: "para hombres", unisex: "unisex" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function decodeBrand(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ marca: string }> }) {
  const entry = await resolveBrand(decodeBrand((await params).marca)).catch(() => null);
  return { title: entry ? entry.brand : "Marca no encontrada" };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ marca: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const entry = await resolveBrand(decodeBrand((await params).marca));
  if (!entry) notFound();

  const query = await searchParams;
  const page = Math.max(1, Math.floor(Number(first(query.page))) || 1);

  const summary = await getBrandSummary(entry);

  // Con las claims de la sesión alcanza (sin ida y vuelta a Supabase).
  const isAuthenticated = !!(await getCurrentUser());
  const collection = isAuthenticated ? await getUserCollection().catch(() => []) : [];

  let perfumes: Perfume[] = [];
  let totalPages = 1;
  let error: string | undefined;
  try {
    const result = await listPerfumes(new URLSearchParams({ brand: entry.brand, page: String(page), pageSize: String(PAGE_SIZE) }));
    if (!result.ok) error = result.error;
    else {
      const body = result.body as { data: Perfume[]; totalPages: number };
      perfumes = body.data;
      totalPages = body.totalPages;
    }
  } catch (e) {
    logServerError("marcas/[marca]", e);
    error = "No se pudo cargar el catálogo de la marca.";
  }

  const pageHref = (p: number) => `/marcas/${encodeURIComponent(entry.brand)}${p > 1 ? `?page=${p}` : ""}`;
  const genders = Object.entries(summary.gendersCount)
    .sort((a, b) => b[1] - a[1])
    .map(([gender, n]) => `${n.toLocaleString("es-AR")} ${GENDER_PLURAL[gender] ?? gender}`);

  return (
    <main id="contenido" className="catalog">
      <Link className="back-link" href="/marcas">
        ← Marcas
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Marca</p>
        <h1>{entry.brand}</h1>
        <p className="catalog-hint">
          {summary.count.toLocaleString("es-AR")} {summary.count === 1 ? "perfume" : "perfumes"}
          {genders.length > 0 && ` · ${genders.join(" · ")}`}
        </p>
        {summary.topAccords.length > 0 && (
          <ul className="home-accords" aria-label={`Acordes característicos de ${entry.brand}`}>
            {summary.topAccords.map((accord) => (
              <li key={accord}>
                <Link href={`/perfumes?brand=${encodeURIComponent(entry.brand)}&accord=${encodeURIComponent(accord)}`}>
                  {accord.charAt(0).toUpperCase() + accord.slice(1)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {perfumes.length === 0 && !error ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">Esta página no tiene perfumes.</p>
          <p>
            <Link href={pageHref(1)}>Volver al principio de {entry.brand}</Link>.
          </p>
        </div>
      ) : (
        <>
          <ul className="catalog-grid">
            {perfumes.map((perfume) => (
              <li key={perfume.id}>
                <PerfumeCard
                  perfume={perfume}
                  collectionEntry={collection.find((c) => c.perfumeId === perfume.id)}
                  isAuthenticated={isAuthenticated}
                />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="catalog-pagination" aria-label="Paginación">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} rel="prev">
                  ← Anterior
                </Link>
              ) : (
                <span aria-disabled="true">← Anterior</span>
              )}
              <span>
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} rel="next">
                  Siguiente →
                </Link>
              ) : (
                <span aria-disabled="true">Siguiente →</span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
