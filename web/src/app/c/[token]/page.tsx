import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getPublicShare } from "@/lib/share/data";
import { PerfumeImage } from "@/app/perfumes/PerfumeImage";
import { genderLabel } from "@/app/perfumes/types";

// Página pública de solo lectura: se renderiza por solicitud (usa headers()) y no se indexa.
const NO_INDEX = { index: false, follow: false } as const;

// Una sola consulta por solicitud, compartida por los metadatos y la página.
const getShare = cache((token: string) => getPublicShare(token));

// Un solo conteo por solicitud (cache sin argumentos): metadatos y página comparten la decisión.
const withinRateLimit = cache(async () => {
  const result = rateLimit("share-view:" + clientIp(await headers()), { limit: 30, windowMs: 60_000 });
  return result.ok;
});

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  // Con límite excedido no se consulta la base; el título genérico no revela nada.
  const limited = !(await withinRateLimit());
  const share = limited ? null : await getShare(token);
  return { title: share ? `Colección de ${share.ownerLabel}` : "Colección compartida", robots: NO_INDEX };
}

export default async function SharedCollectionPage({ params }: Props) {
  const { token } = await params;

  if (!(await withinRateLimit())) {
    return (
      <main id="contenido" className="catalog">
        <div className="catalog-empty">
          <p className="catalog-empty-title">Demasiadas visitas seguidas. Probá de nuevo en un minuto.</p>
        </div>
      </main>
    );
  }

  const share = await getShare(token);
  if (!share) notFound();

  const heading = share.scope === "OWNED" ? `Lo que tiene ${share.ownerLabel}` : `Lo que quiere ${share.ownerLabel}`;

  return (
    <main id="contenido" className="catalog">
      <header className="catalog-header">
        <p className="eyebrow">Colección compartida</p>
        <h1>{heading}</h1>
      </header>

      {share.entries.length === 0 ? (
        <div className="catalog-empty">
          <p className="catalog-empty-title">Todavía no hay perfumes en esta lista.</p>
        </div>
      ) : (
        <ul className="catalog-grid">
          {share.entries.map((entry) => (
            <li key={entry.id}>
              <article className="perfume-card">
                <PerfumeImage name={entry.name} brand={entry.brand} imageUrl={entry.imageUrl} />
                <div className="perfume-card-body">
                  {entry.brand && <p className="perfume-brand">{entry.brand}</p>}
                  <h2 className="perfume-name">{entry.name}</h2>
                  <p className="perfume-meta">{genderLabel(entry.gender)}</p>
                  {entry.rating !== undefined && <p className="share-rating">★ {entry.rating}/5</p>}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
