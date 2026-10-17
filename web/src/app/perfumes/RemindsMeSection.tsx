import Link from "next/link";

import { HorizontalScroller } from "@/components/HorizontalScroller";
import type { RemindsMe } from "@/lib/similar/reminds";
import { PerfumeImage } from "./PerfumeImage";
import { genderLabel } from "./types";

// Carrusel "Me recuerda a": lo que la comunidad dice que huele parecido, con el porcentaje de acuerdo. Es un rollo: avanza solo
// (se frena con el mouse, el foco o movimiento reducido, y tiene botón de pausa), igual que el de /mi-coleccion.
export function RemindsMeSection({ items }: { items: RemindsMe[] }) {
  if (items.length === 0) return null;
  return (
    <section className="ficha-section" aria-labelledby="ficha-recuerda">
      <h2 id="ficha-recuerda">Me recuerda a</h2>
      <p className="community-source">Perfumes que la comunidad dice que huelen parecido, de más a menos votado.</p>
      <HorizontalScroller label="Me recuerda a" autoAdvanceMs={5000} className="reminds-reel">
        <ul className="scroller-track">
          {items.map((item) => (
            <li key={item.id} className="scroller-item">
              <article className="perfume-card perfume-tile">
                <PerfumeImage name={item.name} brand={item.brand} imageUrl={item.imageUrl} accords={item.accords} size="tile" />
                <div className="perfume-card-body">
                  <p className="perfume-brand">{item.brand}</p>
                  <h3 className="perfume-name">
                    <Link href={`/perfumes/${item.id}`}>{item.name}</Link>
                  </h3>
                  <p className="perfume-meta">{genderLabel(item.gender)}</p>
                  <p className="perfume-meta">
                    {item.agreement} % coincide · {(item.upVotes + item.downVotes).toLocaleString("es-AR")} votos
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </HorizontalScroller>
    </section>
  );
}
