"use client";

import { useEffect, useRef, useState } from "react";

import { isAllowedImageUrl } from "@/lib/images";
import { PerfumeCover } from "./PerfumeCover";
import type { PerfumeAccord } from "./types";

export type PerfumeImageSize = "card" | "tile" | "hero" | "thumb";

// Foto del frasco enlazada desde su origen (hotlink: no se descarga ni se re-hospeda; ver docs/imagenes.md).
// Sin foto, con una URL no permitida o si la imagen falla al cargar, se muestra la portada generada.
export function PerfumeImage({
  name,
  brand,
  imageUrl,
  accords,
  size = "card",
  priority = false,
}: {
  name: string;
  brand: string;
  imageUrl?: string | null;
  accords?: PerfumeAccord[];
  size?: PerfumeImageSize;
  /** La primera imagen visible de la página (carga sin diferir). */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // La imagen del HTML del servidor puede fallar antes de que React enganche `onError`: se revisa al montar.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!imageUrl || failed || !isAllowedImageUrl(imageUrl)) {
    return <PerfumeCover name={name} accords={accords} />;
  }

  return (
    <div className={`perfume-media perfume-media-${size}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- enlace directo a propósito: sin optimización de Vercel ni copias */}
      <img
        ref={ref}
        src={imageUrl}
        alt={`Frasco de ${name} de ${brand}`}
        width={375}
        height={500}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
