import Link from "next/link";

import { getSessionDbUserId } from "@/lib/auth/db-user";
import { prisma } from "@/lib/prisma";
import { getSimilarPerfumes } from "@/lib/recommendations/similar";
import { getRemindsMe } from "@/lib/similar/reminds";
import { CollectionForm } from "../CollectionForm";
import { CompareCheckbox } from "../CompareCheckbox";
import { PerfumeImage } from "../PerfumeImage";
import { RemindsMeSection } from "../RemindsMeSection";
import { genderLabel } from "../types";

// Secciones de la ficha que se cargan aparte (cada una en su <Suspense>): lo lento no bloquea lo principal.

const SIMILAR_LIMIT = 6;

export async function CollectionSection({ perfumeId, perfumeName, brand, isAuthenticated }: { perfumeId: string; perfumeName: string; brand: string; isAuthenticated: boolean }) {
  const userId = isAuthenticated ? await getSessionDbUserId() : null;
  const entry = userId
    ? await prisma.userCollection
        .findUnique({
          where: { userId_perfumeId: { userId, perfumeId } },
          select: { status: true, rating: true, personalNotes: true },
        })
        .catch(() => null)
    : null;

  return (
    <section className="ficha-section" aria-labelledby="ficha-acciones">
      <h2 id="ficha-acciones">Tu colección</h2>
      <CompareCheckbox perfumeId={perfumeId} perfumeName={perfumeName} brand={brand} />
      {isAuthenticated ? (
        <CollectionForm perfumeId={perfumeId} initialData={entry ?? undefined} />
      ) : (
        <p>
          <Link href="/login">Iniciá sesión</Link> para agregarlo a tu colección.
        </p>
      )}
    </section>
  );
}

export async function RemindsMeLoader({ perfumeId }: { perfumeId: string }) {
  // Un fallo aquí no debe tumbar la ficha.
  const items = await getRemindsMe(perfumeId).catch(() => []);
  return <RemindsMeSection items={items} />;
}

export async function SimilarSection({ perfumeId }: { perfumeId: string }) {
  const similar = await getSimilarPerfumes(perfumeId, { limit: SIMILAR_LIMIT, userId: await getSessionDbUserId() }).catch(() => null);

  // El ranking no trae foto ni acordes: se piden solo para los que se muestran. Si falla, las tarjetas usan la portada generada.
  const visuals = new Map(
    (similar?.length
      ? await prisma.perfume
          .findMany({
            where: { id: { in: similar.map((item) => item.perfumeId) } },
            select: {
              id: true,
              gender: true,
              imageUrl: true,
              accords: { select: { intensity: true, accord: { select: { name: true } } }, orderBy: { intensity: "desc" }, take: 3 },
            },
          })
          .catch(() => [])
      : []
    ).map((p) => [p.id, p]),
  );

  return (
    <section className="ficha-section" aria-labelledby="ficha-similares">
      <h2 id="ficha-similares">Perfumes similares</h2>
      {!similar || similar.length === 0 ? (
        <p>No encontramos perfumes similares.</p>
      ) : (
        <ul className="catalog-grid">
          {similar.map((item) => {
            const visual = visuals.get(item.perfumeId);
            return (
              <li key={item.perfumeId}>
                <article className="perfume-card">
                  <PerfumeImage name={item.name} brand={item.brand} imageUrl={visual?.imageUrl} accords={visual?.accords} />
                  <div className="perfume-card-body">
                    <p className="perfume-brand">{item.brand}</p>
                    <h3 className="perfume-name">
                      <Link href={`/perfumes/${item.perfumeId}`}>{item.name}</Link>
                    </h3>
                    {visual && <p className="perfume-meta">{genderLabel(visual.gender)}</p>}
                    <p className="perfume-meta">
                      Similitud {Math.round(item.score * 100)}% ·{" "}
                      {item.reasons.map((reason) => (reason === "shared_accords" ? "acordes en común" : "notas en común")).join(" y ")}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
