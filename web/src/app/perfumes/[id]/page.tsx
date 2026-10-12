import { cache, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LONGEVITY_LABELS, scaleLabel } from "@/lib/community";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { LoadBar } from "@/components/LoadBar";
import { CardGridSkeleton, SectionSkeleton } from "@/components/Skeleton";
import { PerfumeImage } from "../PerfumeImage";
import { isAllowedImageUrl, isAllowedSourcePageUrl } from "@/lib/images";
import { CommunityStats } from "../CommunityStats";
import { CollectionSection, RemindsMeLoader, SimilarSection } from "./sections";
import { AccordBars, NotePyramid } from "../PerfumeProfile";
import { genderLabel, PRICE_TIER_LABELS } from "../types";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Una sola consulta por solicitud, compartida por los metadatos y la página.
const getPerfume = cache((id: string) =>
  prisma.perfume.findUnique({
    where: { id },
    include: {
      notes: { include: { note: true }, orderBy: [{ weight: { sort: "desc", nulls: "last" } }, { noteId: "asc" }] },
      accords: { include: { accord: true }, orderBy: { intensity: "desc" } },
    },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfume = await getPerfume(id);
  if (perfume?.status !== "PUBLISHED") return { title: "Perfume no encontrado" };
  const accords = perfume.accords.slice(0, 3).map((a) => a.accord.name).join(", ");
  return {
    title: `${perfume.name} — ${perfume.brand}`,
    description: `${perfume.name} de ${perfume.brand}${accords ? `: acordes ${accords}` : ""}. Notas, estaciones y lo que dice la comunidad.`,
  };
}

export default async function PerfumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfume = await getPerfume(id);
  if (!perfume || perfume.status !== "PUBLISHED") notFound();

  // Con las claims de la sesión (sin ida y vuelta a Supabase) alcanza para saber si hay sesión.
  const isAuthenticated = !!(await getCurrentUser());

  // Duración en horas si es un dato curado; si no, la votada por la comunidad.
  const duration =
    perfume.duration !== null ? `${perfume.duration} h` : perfume.longevity !== null ? scaleLabel(perfume.longevity, LONGEVITY_LABELS) : null;
  const concentration = perfume.concentration ? perfume.concentration.toUpperCase() : null;

  const allDetails: Array<[string, string | null]> = [
    ["Género", capitalize(perfume.gender)],
    ["Concentración", concentration],
    ["Año", perfume.releaseYear !== null ? String(perfume.releaseYear) : null],
    ["Perfumista", perfume.perfumer],
    ["Duración", duration],
  ];
  // Los datos que faltan no se muestran; si no hay ninguno (ni descripción), se oculta la tarjeta entera.
  const details = allDetails.filter((entry): entry is [string, string] => entry[1] !== null);
  const accordBars = perfume.accords.map((a) => ({ name: a.accord.name, intensity: a.intensity }));
  const noteList = perfume.notes.map((n) => ({ noteType: n.noteType, name: n.note.name }));
  const heroFacts = [concentration, perfume.releaseYear !== null ? String(perfume.releaseYear) : null, duration && `Duración: ${duration}`].filter(Boolean);

  return (
    <main id="contenido" className="catalog ficha">
      <Link className="back-link" href="/perfumes">
        ← Catálogo
      </Link>

      <header className="ficha-hero">
        <div className="ficha-hero-media">
          <PerfumeImage name={perfume.name} brand={perfume.brand} imageUrl={perfume.imageUrl} accords={perfume.accords} size="hero" priority />
          {perfume.imageUrl && isAllowedImageUrl(perfume.imageUrl) && perfume.imageSource && (
            <p className="image-credit">
              Imagen:{" "}
              {perfume.imageSourceUrl && isAllowedSourcePageUrl(perfume.imageSourceUrl) ? (
                <a href={perfume.imageSourceUrl} rel="noopener noreferrer" target="_blank">
                  {perfume.imageSource}
                </a>
              ) : (
                perfume.imageSource
              )}
            </p>
          )}
        </div>
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
        {heroFacts.length > 0 && (
          <ul className="ficha-hero-facts" aria-label="Datos clave">
            {heroFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
        <p className="ficha-hero-actions">
          <a className="button" href="#ficha-acciones">
            Guardar en mi colección
          </a>
        </p>
        </div>
      </header>

      {(details.length > 0 || perfume.description) && (
        <section className="ficha-section" aria-labelledby="ficha-datos">
          <h2 id="ficha-datos">Datos</h2>
          {details.length > 0 && (
            <dl className="ficha-details">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {perfume.description && <p>{perfume.description}</p>}
        </section>
      )}

      {accordBars.length > 0 && (
        <section className="ficha-section" aria-labelledby="ficha-acordes">
          <h2 id="ficha-acordes">Acordes</h2>
          <AccordBars accords={accordBars} />
        </section>
      )}

      {noteList.length > 0 && (
        <section className="ficha-section" aria-labelledby="ficha-notas">
          <h2 id="ficha-notas">Notas</h2>
          <NotePyramid notes={noteList} />
        </section>
      )}

      <CommunityStats longevity={perfume.longevity} sillage={perfume.sillage} stats={perfume.stats} />

      <Suspense fallback={<SectionSkeleton title="Tu colección" lines={2} />}>
        <CollectionSection perfumeId={perfume.id} perfumeName={perfume.name} brand={perfume.brand} isAuthenticated={isAuthenticated} />
      </Suspense>

      <Suspense fallback={null}>
        <RemindsMeLoader perfumeId={perfume.id} />
      </Suspense>

      <Suspense
        fallback={
          <section className="ficha-section" aria-busy="true">
            <h2>Perfumes similares</h2>
            <LoadBar label="Calculando perfumes similares" />
            <CardGridSkeleton count={3} />
          </section>
        }
      >
        <SimilarSection perfumeId={perfume.id} />
      </Suspense>
    </main>
  );
}
