import Link from "next/link";

import { getSessionDbUserId } from "@/lib/auth/db-user";
import { prisma } from "@/lib/prisma";
import { getSimilarPerfumes } from "@/lib/recommendations/similar";
import { getRemindsMe } from "@/lib/similar/reminds";
import { CollectionForm } from "../CollectionForm";
import { CompareCheckbox } from "../CompareCheckbox";
import { RemindsMeSection } from "../RemindsMeSection";

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
          <Link href="/login">Iniciá sesión</Link> para añadirlo a tu colección.
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

  return (
    <section className="ficha-section" aria-labelledby="ficha-similares">
      <h2 id="ficha-similares">Perfumes similares</h2>
      {!similar || similar.length === 0 ? (
        <p>No encontramos perfumes similares.</p>
      ) : (
        <ul className="catalog-grid">
          {similar.map((item) => (
            <li key={item.perfumeId} className="perfume-card">
              <div className="perfume-card-body">
                <p className="perfume-brand">{item.brand}</p>
                <h3 className="perfume-name">
                  <Link href={`/perfumes/${item.perfumeId}`}>{item.name}</Link>
                </h3>
                <p className="perfume-meta">
                  Similitud {Math.round(item.score * 100)}% ·{" "}
                  {item.reasons.map((reason) => (reason === "shared_accords" ? "acordes en común" : "notas en común")).join(" y ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
