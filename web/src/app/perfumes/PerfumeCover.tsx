import { coverColors } from "@/lib/cover";
import type { PerfumeAccord } from "./types";

// Portada generada (sin imágenes de terceros): tinte del acorde dominante con el nombre en tipografía de título.
// Es decorativa: el nombre ya está en el encabezado de la tarjeta.
export function PerfumeCover({ name, accords }: { name: string; accords?: PerfumeAccord[] }) {
  const { background, color } = coverColors(accords);
  return (
    <div className="perfume-cover" style={{ background, color }} aria-hidden="true">
      <span>{name}</span>
    </div>
  );
}
