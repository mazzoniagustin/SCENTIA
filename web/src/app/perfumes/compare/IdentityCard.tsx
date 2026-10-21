"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { seriesColor } from "@/lib/compare/radar";
import { Perfume, valueOrNoData } from "../types";
import { PerfumeImage } from "../PerfumeImage";

export function IdentityCard({
  perfume,
  index,
  ids,
}: {
  perfume: Perfume;
  index: number;
  ids: string[];
}) {
  const router = useRouter();

  const remove = () => {
    const nextIds = ids.filter((id) => id !== perfume.id);
    if (nextIds.length < 2) {
      router.push("/perfumes");
    } else {
      const params = new URLSearchParams({ ids: nextIds.join(",") });
      router.push(`/perfumes/compare?${params.toString()}`);
    }
  };

  return (
    <article
      className="compare-card"
      style={{ "--series-color": seriesColor(index) } as React.CSSProperties}
    >
      <button
        onClick={remove}
        className="compare-card-remove"
        aria-label={`Quitar ${perfume.name}`}
      >
        ×
      </button>
      <div className="compare-card-media">
        <PerfumeImage name={perfume.name} brand={perfume.brand} imageUrl={perfume.imageUrl} accords={perfume.accords} size="thumb" />
      </div>
      <p className="compare-card-brand">{perfume.brand}</p>
      <h2 className="compare-card-name">{perfume.name}</h2>
      <p className="compare-card-meta">
        {[perfume.concentration?.toUpperCase(), perfume.releaseYear]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <dl>
        <div>
          <dt>Perfumer</dt>
          <dd>{valueOrNoData(perfume.perfumer, (p) => p)}</dd>
        </div>
        <div>
          <dt>Duración</dt>
          <dd>{valueOrNoData(perfume.duration, (d) => `${d} h`)}</dd>
        </div>
        <div>
          <dt>Proyección</dt>
          <dd>{valueOrNoData(perfume.projection, (p) => `${p} de 4`)}</dd>
        </div>
      </dl>
    </article>
  );
}
