import Link from "next/link";
import { notFound } from "next/navigation";

import { getUserCollection } from "@/app/actions/collection";
import { getSessionDbUserId } from "@/lib/auth/db-user";
import { prisma } from "@/lib/prisma";
import { getSimilarPerfumes } from "@/lib/recommendations/similar";
import { createClient } from "@/lib/supabase/server";
import { CollectionForm } from "../CollectionForm";
import { CompareCheckbox } from "../CompareCheckbox";
import { PerfumeCover } from "../PerfumeCover";
import { CommunityStats } from "../CommunityStats";
import { AccordBars, NotePyramid } from "../PerfumeProfile";
import { genderLabel, PRICE_TIER_LABELS, valueOrNoData } from "../types";

const SIMILAR_LIMIT = 6;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfume = await prisma.perfume.findUnique({ where: { id }, select: { brand: true, name: true, status: true } });
  return { title: perfume?.status === "PUBLISHED" ? `${perfume.name} — ${perfume.brand}` : "Perfume no encontrado" };
}

export default async function PerfumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const perfume = await prisma.perfume.findUnique({
    where: { id },
    include: {
      notes: { include: { note: true }, orderBy: [{ weight: { sort: "desc", nulls: "last" } }, { noteId: "asc" }] },
      accords: { include: { accord: true }, orderBy: { intensity: "desc" } },
    },
  });
  if (!perfume || perfume.status !== "PUBLISHED") notFound();

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
    <main id="contenido" className="catalog ficha">
      <Link className="back-link" href="/perfumes">
        ← Catálogo
      </Link>

      <header className="ficha-hero">
        <PerfumeCover name={perfume.name} accords={perfume.accords} />
        <div className="ficha-hero-text">
        <p className="eyebrow">
          {perfume.brand} · {genderLabel(perfume.gender)}
        </p>
        <h1>{perfume.name}</h1>
        {(perfume.priceTier || perfume.seasons.length > 0) && (
          <ul className="perfume-badges" aria-label="Categoría y estaciones">
            {perfume.priceTier && <li>{PRICE_TIER_LABELS[perfume.priceTier]}</li>}
            {perfume.seasons.map((season) => (
              <li key={season}>{season}</li>
            ))}
          </ul>
        )}
        </div>
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
        <AccordBars accords={perfume.accords.map((a) => ({ name: a.accord.name, intensity: a.intensity }))} />
      </section>

      <section className="ficha-section" aria-labelledby="ficha-notas">
        <h2 id="ficha-notas">Notas</h2>
        <NotePyramid notes={perfume.notes.map((n) => ({ noteType: n.noteType, name: n.note.name }))} />
      </section>

      <CommunityStats longevity={perfume.longevity} sillage={perfume.sillage} stats={perfume.stats} />

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
                <div className="perfume-card-body">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
