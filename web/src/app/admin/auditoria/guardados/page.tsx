import Link from "next/link";
import { notFound } from "next/navigation";

import { SAVED_PAGE_SIZE, getSavedPerfumes } from "@/lib/admin/audit-data";
import { pageCount, parsePage } from "@/lib/admin/audit-report";
import { getSuperadminOrNull } from "@/lib/auth/superadmin";

export const metadata = { title: "Todos los guardados", robots: { index: false, follow: false } };

const nf = new Intl.NumberFormat("es-AR");

// Todos los perfumes guardados en alguna colección (activa o eliminada) y cuántas veces. Solo conteos por perfume, sin personas.
// Solo para el superadmin: para cualquier otra persona la ruta no existe (404).
export default async function SavedPerfumesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const admin = await getSuperadminOrNull();
  if (!admin) notFound();

  const params = await searchParams;
  // La cantidad de páginas hace falta para acotar `page`: se calcula con el total de perfumes distintos.
  const first = await getSavedPerfumes(1);
  const page = parsePage(params.page, pageCount(first.totalPerfumes, SAVED_PAGE_SIZE));
  const { rows, totalPerfumes, pages } = page === 1 ? first : await getSavedPerfumes(page);
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
          {nf.format(totalPerfumes)} perfumes distintos guardados en colecciones activas y eliminadas, de más a menos guardados. Solo
          conteos: no se sabe quién guardó cada uno.
        </p>
      </header>

      {rows.length === 0 ? (
        <p>Todavía no hay perfumes en colecciones.</p>
      ) : (
        <>
          <div className="compare-table-scroll" role="region" aria-label="Perfumes guardados" tabIndex={0}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Perfume</th>
                  <th scope="col">Guardado</th>
                  <th scope="col">Lo tengo</th>
                  <th scope="col">Probé</th>
                  <th scope="col">Deseado</th>
                  <th scope="col">Descartado</th>
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
                    <td>{nf.format(row.owned)}</td>
                    <td>{nf.format(row.sampled)}</td>
                    <td>{nf.format(row.wishlist)}</td>
                    <td>{nf.format(row.disliked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="admin-pager" aria-label="Páginas">
              {page > 1 ? <Link href={`/admin/auditoria/guardados?page=${page - 1}`}>← Anterior</Link> : <span aria-hidden="true" />}
              <span>
                Página {page} de {pages}
              </span>
              {page < pages ? <Link href={`/admin/auditoria/guardados?page=${page + 1}`}>Siguiente →</Link> : <span aria-hidden="true" />}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
