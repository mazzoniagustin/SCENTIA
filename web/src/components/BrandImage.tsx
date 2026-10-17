import Image from "next/image";

import { getBrandAsset, isSvg, type BrandSlot } from "@/lib/brand-assets";

// Imagen de identidad de un lugar de la página (ver lib/brand-assets.ts). Si el archivo todavía no está cargado no dibuja
// nada (sin imagen rota ni espacio vacío); con archivo, reserva el tamaño real (width/height) y no mueve el contenido.
export function BrandImage({ slot, className, priority = false }: { slot: BrandSlot; className?: string; priority?: boolean }) {
  const asset = getBrandAsset(slot);
  if (!asset) return null;
  return (
    <Image
      className={className}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={asset.alt}
      priority={priority}
      unoptimized={isSvg(asset.src)}
    />
  );
}
