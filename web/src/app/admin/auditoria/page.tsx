import Link from "next/link";
import { notFound } from "next/navigation";

import { average, barWidth, monthLabel, percent } from "@/lib/admin/audit-report";
import { getAuditData } from "@/lib/admin/audit-data";
import { getSuperadminOrNull } from "@/lib/auth/superadmin";

export const metadata = { title: "Auditoría", robots: { index: false, follow: false } };

const nf = new Intl.NumberFormat("es-AR");
const fmt = (value: number | null, suffix = "") => (value === null ? "—" : `${nf.format(value)}${suffix}`);

// Auditoría para el superadmin (SUPERADMIN_EMAILS): solo agregados, sin correos, nombres, apodos, ids de personas ni notas.
// Para cualquier otra persona la ruta no existe (404), así no se revela que está.
export default async function AuditPage() {
  const admin = await getSuperadminOrNull();
  if (!admin) notFound();

  const data = await getAuditData();
  const ever = data.accounts.active + data.accounts.deleted;
  const live = data.liveCollections;
  const gone = data.deletedCollections;
  const maxMonth = Math.max(1, ...data.timeline.map((row) => Math.max(row.registered, row.deleted)));
  const maxTop = Math.max(1, ...data.topPerfumes.map((p) => p.count));
  const statusRows: Array<[string, number, number]> = [
    ["Lo tengo", live.owned, gone.owned],
    ["Probé una muestra", live.sampled, gone.sampled],
    ["Lista de deseados", live.wishlist, gone.wishlist],
    ["Descartados", live.disliked, gone.disliked],
    ["Total", live.total, gone.total],
  ];

  return (
    <main id="contenido" className="catalog ficha">
      <Link className="back-link" href="/account">
        ← Mi cuenta
      </Link>
      <header className="catalog-header">
        <p className="eyebrow">Superadmin</p>
        <h1>Auditoría</h1>
        <p className="lead">
          Números agregados de las cuentas y de las colecciones. No incluye correos, nombres, apodos ni notas. Actualizado el{" "}
          {new Date(data.generatedAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}.
        </p>
      </header>

      <section className="ficha-section" aria-labelledby="au-cuentas">
        <h2 id="au-cuentas">Cuentas</h2>
        <dl className="home-stats">
          <div><dd>{nf.format(data.accounts.active)}</dd><dt>Activas</dt></div>
          <div><dd>{nf.format(data.accounts.deleted)}</dd><dt>Eliminadas</dt></div>
          <div><dd>{nf.format(ever)}</dd><dt>Registradas en total</dt></div>
          <div><dd>{fmt(percent(data.accounts.deleted, ever), " %")}</dd><dt>Bajas sobre el total</dt></div>
        </dl>
      </section>

      <section className="ficha-section" aria-labelledby="au-meses">
        <h2 id="au-meses">Altas y bajas por mes</h2>
        {data.timeline.length === 0 ? (
          <p>Todavía no hay movimientos.</p>
        ) : (
          <div className="compare-table-scroll" role="region" aria-label="Altas y bajas por mes" tabIndex={0}>
            <table className="compare-table">
              <thead>
                <tr><th scope="col">Mes</th><th scope="col">Altas</th><th scope="col">Bajas</th><th scope="col">Saldo</th></tr>
              </thead>
              <tbody>
                {[...data.timeline].reverse().map((row) => (
                  <tr key={row.month}>
                    <th scope="row">{monthLabel(row.month)}</th>
                    <td>
                      <span className="admin-bar" style={{ width: `${barWidth(row.registered, maxMonth)}%` }} aria-hidden="true" /> {nf.format(row.registered)}
                    </td>
                    <td>
                      <span className="admin-bar admin-bar-muted" style={{ width: `${barWidth(row.deleted, maxMonth)}%` }} aria-hidden="true" /> {nf.format(row.deleted)}
                    </td>
                    <td>{row.net > 0 ? `+${nf.format(row.net)}` : nf.format(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="community-source">Las altas incluyen a quienes se registraron ese mes y después eliminaron su cuenta.</p>
      </section>

      <section className="ficha-section" aria-labelledby="au-colecciones">
        <h2 id="au-colecciones">Perfumes en colecciones</h2>
        <div className="compare-table-scroll" role="region" aria-label="Perfumes en colecciones" tabIndex={0}>
          <table className="compare-table">
            <thead>
              <tr><th scope="col">Estado</th><th scope="col">Cuentas activas</th><th scope="col">Cuentas eliminadas</th></tr>
            </thead>
            <tbody>
              {statusRows.map(([label, a, b]) => (
                <tr key={label}><th scope="row">{label}</th><td>{nf.format(a)}</td><td>{nf.format(b)}</td></tr>
              ))}
              <tr>
                <th scope="row">Perfumes por cuenta</th>
                <td>{fmt(average(live.total, live.accountsWithCollection))}</td>
                <td>{fmt(average(gone.total, data.accounts.deleted))}</td>
              </tr>
              <tr>
                <th scope="row">Valoración promedio</th>
                <td>{fmt(average(live.ratingsSum, live.ratingsCount))}</td>
                <td>{fmt(average(gone.ratingsSum, gone.ratingsCount))}</td>
              </tr>
              <tr>
                <th scope="row">Valoraciones cargadas</th>
                <td>{nf.format(live.ratingsCount)}</td>
                <td>{nf.format(gone.ratingsCount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="community-source">
          Cuentas activas con al menos un perfume: {nf.format(live.accountsWithCollection)}. Las eliminadas conservan solo este resumen anónimo.
        </p>
      </section>

      <section className="ficha-section" aria-labelledby="au-actividad">
        <h2 id="au-actividad">Actividad</h2>
        <dl className="home-stats">
          <div><dd>{nf.format(data.live.quizProfiles)}</dd><dt>Perfiles de quiz guardados (activas)</dt></div>
          <div><dd>{nf.format(data.deletedActivity.withQuizProfile)}</dd><dt>Eliminadas con quiz</dt></div>
          <div><dd>{nf.format(data.live.wearLogs)}</dd><dt>Días con perfume registrados (activas)</dt></div>
          <div><dd>{nf.format(data.deletedActivity.longestStreakMax)}</dd><dt>Racha más larga entre eliminadas</dt></div>
        </dl>
        <p className="community-source">
          Racha promedio de las cuentas eliminadas: {fmt(average(data.deletedActivity.longestStreakSum, data.accounts.deleted))} días.
        </p>
      </section>

      <section className="ficha-section" aria-labelledby="au-top">
        <h2 id="au-top">Perfumes más guardados</h2>
        {data.topPerfumes.length === 0 ? (
          <p>Todavía no hay perfumes en colecciones.</p>
        ) : (
          <ol className="admin-top">
            {data.topPerfumes.map((perfume) => (
              <li key={perfume.id}>
                <Link href={`/perfumes/${perfume.id}`}>
                  {perfume.brand} — {perfume.name}
                </Link>
                <span className="admin-bar" style={{ width: `${barWidth(perfume.count, maxTop)}%` }} aria-hidden="true" />
                <strong>{nf.format(perfume.count)}</strong>
              </li>
            ))}
          </ol>
        )}
        <p className="community-source">
          Cuenta colecciones activas y eliminadas, en cualquier estado. <Link href="/admin/auditoria/guardados">Ver todos los guardados</Link>
        </p>
      </section>
    </main>
  );
}
