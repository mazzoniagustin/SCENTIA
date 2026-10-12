"use client";

import Link from "next/link";

import { useCompareSelection } from "../compare-store";

// Estado vacío del comparador: explica el recorrido en 3 pasos y, si ya hay un perfume elegido (selección guardada
// en el navegador), lo dice. `urlCount` es la cantidad de ids que llegó por la URL (0 o 1).
export function CompareEmpty({ urlCount }: { urlCount: number }) {
  const selected = useCompareSelection();
  const count = Math.max(selected.length, urlCount === 1 ? 1 : 0);
  const title =
    count === 1
      ? "Elegí al menos uno más para comparar."
      : "Comparás de a 2 a 4 perfumes, lado a lado.";

  return (
    <div className="compare-empty">
      <p className="compare-empty-title">{title}</p>
      {selected.length === 1 && (
        <p>
          Ya marcaste <strong>{selected[0].name}</strong> ({selected[0].brand}).
        </p>
      )}
      <ol className="compare-steps">
        <li>Buscá perfumes en el catálogo.</li>
        <li>
          Marcá <strong>Comparar</strong> en 2 a 4 de ellos.
        </li>
        <li>
          Apretá <strong>Comparar</strong> en la barra que aparece abajo.
        </li>
      </ol>
      <p>
        <Link className="button" href="/perfumes">
          Ir al catálogo
        </Link>
      </p>
      <p className="compare-empty-note">
        También podés compartir un enlace con <code>?ids=…</code> (los ids separados por coma).
      </p>
    </div>
  );
}
