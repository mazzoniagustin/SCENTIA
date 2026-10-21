import Link from "next/link";
import { notFound } from "next/navigation";

import { SAVED_PAGE_SIZE, getSavedPerfumes } from "@/lib/admin/audit-data";
import { pageCount, parsePage, parseSavedFilters, type SavedFilters } from "@/lib/admin/audit-report";
import { getSuperadminOrNull } from "@/lib/auth/superadmin";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/collection/overview";
import { GENDER_LABELS, GENDERS } from "@/lib/perfumes/filter-labels";

export const metadata = { title: "Todos los guardados", robots: { index: false, follow: false } };

const nf = new Intl.NumberFormat("es-AR");

/** Enlace a la lista con los filtros dados; la página vuelve a la 1 salvo que se pida otra. */
function savedHref(filters: SavedFilters, page = 1): string {
  const query = new URLSearchParams();
  if (filters.gender) query.set("genero", filters.gender);
  if (filters.status) query.set("estado", filters.status);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return `/admin/auditoria/guardados${text ? `?${text}` : ""}`;
}

const cell = (value: number, active: boolean) => (active ? <strong>{nf.format(value)}</strong> : nf.format(value));

// Misma estructura que las pestañas de "Mi colección" (.collection-tabs): lista de enlaces con aria-current="page" en el activo.
function FilterGroup<T extends string>({ label, options, labels, current, hrefFor }: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  current: T | null;
  hrefFor: (value: T | null) => string;
}) {
  return (
    <nav className="collection-tabs admin-filters" aria-label={label}>
      <ul>
        {[null, ...options].map((value) => (
          <li key={value ?? "todos"}>
            <Link href={hrefFor(value)} aria-current={value === current ? "page" : undefined}>
              {value ? labels[value] : "Todos"}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function SavedPerfumesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const admin = await getSuperadminOrNull();
  if (!admin) notFound();

  const params = await searchParams;
  // La cantidad de páginas hace falta para acotar `page`: se calcula con el total de perfumes distintos.
  const filters = parseSavedFilters(params);
  const first = await getSavedPerfumes(1, filters);
  const page = parsePage(params.page, pageCount(first.totalPerfumes, SAVED_PAGE_SIZE));
  const { rows, totalPerfumes, pages } = page === 1 ? first : await getSavedPerfumes(page, filters);
  const start = (page - 1) * SAVED_PAGE_SIZE;

  return (
    <main id="contenido" className="catalog ficha">
      <Link className="back-link" href="/admin/auditoria">
        ← Auditoría
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Superadmin</p>
        <h1>Todos los guardados</h1>
        <p className="lead">
          {nf.format(totalPerfumes)} perfumes distintos guardados en colecciones activas y eliminadas
          {filters.gender && <>, de género {filters.gender}</>}
          {filters.status && <>, con al menos un guardado como «{STATUS_LABELS[filters.status]}»</>}
          , de más a menos {filters.status ? `«${STATUS_LABELS[filters.status]}»` : "guardados"}. Solo conteos: no se sabe quién guardó cada uno.
        </p>
      </header>

      <FilterGroup label="Filtrar por género" options={GENDERS} labels={GENDER_LABELS} current={filters.gender} hrefFor={(gender) => savedHref({ ...filters, gender })} />
      <FilterGroup label="Filtrar por estado" options={STATUS_ORDER} labels={STATUS_LABELS} current={filters.status} hrefFor={(status) => savedHref({ ...filters, status })} />

      {rows.length === 0 ? (
        <p>{filters.gender || filters.status ? "No hay perfumes guardados con esos filtros." : "Todavía no hay perfumes en colecciones."}</p>
      ) : (
        <>
          <div className="compare-table-scroll" role="region" aria-label="Perfumes guardados" tabIndex={0}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Perfume</th>
                  <th scope="col">Guardado</th>
                  <th scope="col" aria-sort={filters.status === "OWNED" ? "descending" : undefined}>Lo tengo</th>
                  <th scope="col" aria-sort={filters.status === "SAMPLED" ? "descending" : undefined}>Probé</th>
                  <th scope="col" aria-sort={filters.status === "WISHLIST" ? "descending" : undefined}>Deseado</th>
                  <th scope="col" aria-sort={filters.status === "DISLIKED" ? "descending" : undefined}>Descartado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{start + index + 1}</td>
                    <th scope="row">
                      <Link href={`/perfumes/${row.id}`}>
                        {row.brand} — {row.name}
                      </Link>
                    </th>
                    <td>
                      <strong>{nf.format(row.total)}</strong>
                    </td>
                    <td>{cell(row.owned, filters.status === "OWNED")}</td>
                    <td>{cell(row.sampled, filters.status === "SAMPLED")}</td>
                    <td>{cell(row.wishlist, filters.status === "WISHLIST")}</td>
                    <td>{cell(row.disliked, filters.status === "DISLIKED")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="admin-pager" aria-label="Páginas">
              {page > 1 ? <Link href={savedHref(filters, page - 1)}>← Anterior</Link> : <span aria-hidden="true" />}
              <span>
                Página {page} de {pages}
              </span>
              {page < pages ? <Link href={savedHref(filters, page + 1)}>Siguiente →</Link> : <span aria-hidden="true" />}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
