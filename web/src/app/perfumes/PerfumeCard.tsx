import Link from "next/link";

import { CollectionForm } from "./CollectionForm";
import { CompareCheckbox } from "./CompareCheckbox";
import { PerfumeImage } from "./PerfumeImage";
import { genderLabel, type Perfume, PRICE_TIER_LABELS } from "./types";

export function PerfumeCard({ perfume, collectionEntry, isAuthenticated }: { perfume: Perfume; collectionEntry?: { status: string; rating?: number | null; personalNotes?: string | null }; isAuthenticated: boolean }) {
  const priceTierLabel = perfume.priceTier ? PRICE_TIER_LABELS[perfume.priceTier] : null;
  const meta = [genderLabel(perfume.gender), perfume.concentration?.toUpperCase(), perfume.releaseYear].filter(Boolean).join(" · ");

  return (
    <article className="perfume-card">
      <PerfumeImage name={perfume.name} brand={perfume.brand} imageUrl={perfume.imageUrl} accords={perfume.accords} />
      <div className="perfume-card-body">
        <p className="perfume-brand">{perfume.brand}</p>
        <h2 className="perfume-name">
          <Link href={`/perfumes/${perfume.id}`}>{perfume.name}</Link>
        </h2>
        {meta && <p className="perfume-meta">{meta}</p>}
        {(priceTierLabel || perfume.seasons.length > 0) && (
          <ul className="perfume-badges" aria-label="Categoría y estaciones">
            {priceTierLabel && <li>{priceTierLabel}</li>}
            {perfume.seasons.map((season) => (
              <li key={season}>{season}</li>
            ))}
          </ul>
        )}
        {perfume.occasions.length > 0 && (
          <ul className="perfume-badges" aria-label="Ocasiones">
            {perfume.occasions.map((occasion) => (
              <li key={occasion}>{occasion}</li>
            ))}
          </ul>
        )}

        <div className="perfume-card-footer">
          <CompareCheckbox perfumeId={perfume.id} perfumeName={perfume.name} />
          {isAuthenticated && (
            <details>
              <summary>{collectionEntry ? "En tu colección" : "Guardar en mi colección"}</summary>
              <CollectionForm perfumeId={perfume.id} initialData={collectionEntry} />
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
