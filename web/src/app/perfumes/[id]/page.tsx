import Link from "next/link";
import { notFound } from "next/navigation";

import { getUserCollection } from "@/app/actions/collection";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { prisma } from "@/lib/prisma";
import { getSimilarPerfumes } from "@/lib/recommendations/similar";
import { createClient } from "@/lib/supabase/server";
import { CollectionForm } from "../CollectionForm";
import { CompareCheckbox } from "../CompareCheckbox";
import { PRICE_TIER_LABELS, valueOrNoData } from "../types";

const SIMILAR_LIMIT = 6;

const PHASES = [
  { type: "top", label: "Salida" },
  { type: "heart", label: "Corazón" },
  { type: "base", label: "Fondo" },
] as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfume = await prisma.perfume.findUnique({ where: { id }, select: { brand: true, name: true } });
  return { title: perfume ? `${perfume.name} — ${perfume.brand}` : "Perfume no encontrado" };
}

export default async function PerfumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const perfume = await prisma.perfume.findUnique({
    where: { id },
    include: {
      notes: { include: { note: true } },
      accords: { include: { accord: true }, orderBy: { intensity: "desc" } },
    },
  });
  if (!perfume) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthenticated = !!data.user;

  const [similar, collection] = await Promise.all([
    getSimilarPerfumes(id, { limit: SIMILAR_LIMIT, userId: await getSessionDbUserId() }),
    isAuthenticated ? getUserCollection().catch(() => []) : Promise.resolve([]),
  ]);
  const collectionEntry = collection.find((entry) => entry.perfumeId === id);

  const details: Array<[string, string]> = [
    ["Género", capitalize(perfume.gender)],
    ["Concentración", valueOrNoData(perfume.concentration, (c) => c.toUpperCase())],
    ["Año", valueOrNoData(perfume.releaseYear, String)],
    ["Perfumista", valueOrNoData(perfume.perfumer, String)],
    ["Duración", valueOrNoData(perfume.duration, (d) => `${d} h`)],
  ];

  return (
    <main className="catalog ficha">
      <Link className="back-link" href="/perfumes">
        ← Catálogo
      </Link>

      <header className="catalog-header">
        <p className="eyebrow">{perfume.brand}</p>
        <h1>{perfume.name}</h1>
        {(perfume.priceTier || perfume.seasons.length > 0) && (
          <ul className="perfume-badges" aria-label="Categoría y estaciones">
            {perfume.priceTier && <li>{PRICE_TIER_LABELS[perfume.priceTier]}</li>}
            {perfume.seasons.map((season) => (
              <li key={season}>{season}</li>
            ))}
          </ul>
        )}
      </header>

      <section className="ficha-section" aria-labelledby="ficha-datos">
        <h2 id="ficha-datos">Datos</h2>
        <dl className="ficha-details">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {perfume.description && <p>{perfume.description}</p>}
      </section>

      <section className="ficha-section" aria-labelledby="ficha-acordes">
        <h2 id="ficha-acordes">Acordes</h2>
        {perfume.accords.length === 0 ? (
          <p>Sin dato</p>
        ) : (
          <ul className="ficha-accords">
            {perfume.accords.map(({ accord, intensity }) => (
              <li key={accord.id}>
                <span>{capitalize(accord.name)}</span>
                <span className="ficha-bar" role="img" aria-label={`${intensity} de 100`}>
                  <span style={{ width: `${intensity}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ficha-section" aria-labelledby="ficha-notas">
        <h2 id="ficha-notas">Notas</h2>
        {perfume.notes.length === 0 ? (
          <p>Sin dato</p>
        ) : (
          <div className="ficha-phases">
            {PHASES.map(({ type, label }) => {
              const names = perfume.notes.filter((n) => n.noteType === type).map((n) => n.note.name);
              return (
                <div key={type}>
                  <h3>{label}</h3>
                  {names.length === 0 ? (
                    <p>Sin dato</p>
                  ) : (
                    <ul className="perfume-badges">
                      {names.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ficha-section" aria-labelledby="ficha-acciones">
        <h2 id="ficha-acciones">Tu colección</h2>
        <CompareCheckbox perfumeId={perfume.id} perfumeName={perfume.name} />
        {isAuthenticated ? (
          <CollectionForm perfumeId={perfume.id} initialData={collectionEntry} />
        ) : (
          <p>
            <Link href="/login">Iniciá sesión</Link> para añadirlo a tu colección.
          </p>
        )}
      </section>

      <section className="ficha-section" aria-labelledby="ficha-similares">
        <h2 id="ficha-similares">Perfumes similares</h2>
        {!similar || similar.length === 0 ? (
          <p>No encontramos perfumes similares.</p>
        ) : (
          <ul className="catalog-grid">
            {similar.map((item) => (
              <li key={item.perfumeId} className="perfume-card">
                <p className="perfume-brand">{item.brand}</p>
                <h3 className="perfume-name">
                  <Link href={`/perfumes/${item.perfumeId}`}>{item.name}</Link>
                </h3>
                <p className="perfume-meta">
                  Similitud {Math.round(item.score * 100)}% ·{" "}
                  {item.reasons
                    .map((reason) => (reason === "shared_accords" ? "acordes en común" : "notas en común"))
                    .join(" y ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
