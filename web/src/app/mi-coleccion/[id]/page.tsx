import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LONGEVITY_LABELS, SILLAGE_LABELS, scaleLabel } from "@/lib/community";
import { STATUS_LABELS, ratingLabel, type CollectionStatusValue } from "@/lib/collection/overview";
import { getAuthenticatedUserOrNull } from "@/lib/auth/require-user";
import { getOwnPrivatePerfume } from "@/lib/private-perfumes/data";
import { displayImageUrls } from "@/lib/private-perfumes/storage";
import { PerfumeImage } from "../../perfumes/PerfumeImage";
import { AccordBars, NotePyramid } from "../../perfumes/PerfumeProfile";
import { genderLabel } from "../../perfumes/types";
import { DeletePrivatePerfumeForm } from "../DeletePrivatePerfumeForm";

export const metadata = { title: "Mi perfume" };

// Ficha de un perfume propio: solo la ve su dueño. Para cualquier otra persona (o un perfume del catálogo) responde 404.
export default async function PrivatePerfumePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) redirect("/login");

  const { id } = await params;
  const perfume = await getOwnPrivatePerfume(user.id, id);
  if (!perfume) notFound();

  const [photoUrl] = await displayImageUrls([{ status: "PRIVATE", imageUrl: perfume.imagePath }]);

  const details: Array<[string, string | null]> = [
    ["Para", genderLabel(perfume.gender)],
    ["Perfumista", perfume.perfumer],
    ["Duración", perfume.longevity !== null ? scaleLabel(perfume.longevity, LONGEVITY_LABELS) : null],
    ["Estela", perfume.sillage !== null ? scaleLabel(perfume.sillage, SILLAGE_LABELS) : null],
  ];
  const shown = details.filter((entry): entry is [string, string] => entry[1] !== null);
  const notes = [
    ...perfume.topNotes.map((name) => ({ noteType: "top", name })),
    ...perfume.heartNotes.map((name) => ({ noteType: "heart", name })),
    ...perfume.baseNotes.map((name) => ({ noteType: "base", name })),
  ];
  const accordBars = perfume.accords.map((a) => ({ name: a.name, intensity: a.intensity }));

  return (
    <main id="contenido" className="catalog ficha">
      <Link className="back-link" href="/mi-coleccion">
        ← Mi colección
      </Link>

      <header className="ficha-hero">
        <div className="ficha-hero-media">
          <PerfumeImage name={perfume.name} brand={perfume.brand} imageUrl={photoUrl} accords={perfume.accords.map((a) => ({ intensity: a.intensity, accord: { name: a.name } }))} size="hero" priority />
        </div>
        <div className="ficha-hero-text">
          <p className="eyebrow">{perfume.brand ? `${perfume.brand} · Propio` : "Perfume propio"}</p>
          <h1>{perfume.name}</h1>
          <ul className="perfume-badges" aria-label="Estado y puntuación">
            <li className={`collection-status-${perfume.entry.status.toLowerCase()}`}>
              {STATUS_LABELS[perfume.entry.status as CollectionStatusValue] ?? perfume.entry.status}
            </li>
            {ratingLabel(perfume.entry.rating) && <li>★ {ratingLabel(perfume.entry.rating)}</li>}
          </ul>
          <p className="ficha-hero-actions">
            <Link className="button" href={`/mi-coleccion/${perfume.id}/editar`}>
              Editar
            </Link>
          </p>
        </div>
      </header>

      {(shown.length > 0 || perfume.description || perfume.entry.personalNotes) && (
        <section className="ficha-section" aria-labelledby="ficha-datos">
          <h2 id="ficha-datos">Datos</h2>
          {shown.length > 0 && (
            <dl className="ficha-details">
              {shown.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {perfume.description && <p>{perfume.description}</p>}
          {perfume.entry.personalNotes && <p className="collection-notes">{perfume.entry.personalNotes}</p>}
        </section>
      )}

      {accordBars.length > 0 && (
        <section className="ficha-section" aria-labelledby="ficha-acordes">
          <h2 id="ficha-acordes">Acordes</h2>
          <AccordBars accords={accordBars} />
        </section>
      )}

      {notes.length > 0 && (
        <section className="ficha-section" aria-labelledby="ficha-notas">
          <h2 id="ficha-notas">Notas</h2>
          <NotePyramid notes={notes} />
        </section>
      )}

      <section className="ficha-section" aria-labelledby="ficha-eliminar">
        <h2 id="ficha-eliminar">Eliminar</h2>
        <DeletePrivatePerfumeForm perfumeId={perfume.id} />
      </section>
    </main>
  );
}
