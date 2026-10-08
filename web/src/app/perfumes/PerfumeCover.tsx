import { coverColors, initialsOf } from "@/lib/cover";
import type { PerfumeAccord } from "./types";

// Portada generada (sin imágenes de terceros): tinte del acorde dominante, monograma y el acorde como etiqueta.
// Es decorativa: el nombre y los acordes ya están en el texto de la tarjeta.
export function PerfumeCover({ name, accords }: { name: string; accords?: PerfumeAccord[] }) {
  const { background, color, accord } = coverColors(accords);
  return (
    <div className="perfume-cover" style={{ background, color }} aria-hidden="true">
      <span className="perfume-cover-label">{accord ?? " "}</span>
      <span className="perfume-cover-mark">{initialsOf(name)}</span>
    </div>
  );
}
