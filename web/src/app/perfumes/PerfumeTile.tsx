import Link from "next/link";

import { PerfumeImage } from "./PerfumeImage";
import { genderLabel } from "./types";
import type { FeaturedPerfume } from "@/lib/home/featured";

// Tarjeta compacta (portada generada + marca + nombre) para listas destacadas.
export function PerfumeTile({ perfume }: { perfume: FeaturedPerfume }) {
  return (
    <article className="perfume-card perfume-tile">
      <PerfumeImage name={perfume.name} brand={perfume.brand} imageUrl={perfume.imageUrl} accords={perfume.accords} size="tile" />
      <div className="perfume-card-body">
        <p className="perfume-brand">{perfume.brand}</p>
        <h3 className="perfume-name">
          <Link href={`/perfumes/${perfume.id}`}>{perfume.name}</Link>
        </h3>
        <p className="perfume-meta">{genderLabel(perfume.gender)}</p>
      </div>
    </article>
  );
}
