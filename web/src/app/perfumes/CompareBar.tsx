"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { compareHref, MAX_COMPARE, MIN_COMPARE } from "@/lib/compare/selection";
import { clearCompare, removeCompare, useCompareSelection } from "./compare-store";

// Barra fija con los perfumes elegidos para comparar. Está en el layout: se ve en cualquier página, así que se puede
// buscar otro perfume (o cambiar de marca o de página) sin perder lo ya elegido.
export function CompareBar() {
  const items = useCompareSelection();
  const pathname = usePathname();

  // En el propio comparador no hace falta (ahí cada tarjeta tiene su botón para quitar).
  if (items.length === 0 || pathname.startsWith("/perfumes/compare")) return null;

  const href = compareHref(items);

  return (
    <>
      <div className="compare-bar-spacer" aria-hidden="true" />
      <aside className="compare-bar" aria-label="Perfumes para comparar">
        <ul className="compare-bar-items">
          {items.map((item) => (
            <li key={item.id} className="compare-bar-chip">
              <span>
                <small>{item.brand}</small> {item.name}
              </span>
              <button type="button" onClick={() => removeCompare(item.id)} aria-label={`Quitar ${item.name} de la comparación`}>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="compare-bar-actions">
          <span className="compare-bar-count" role="status">
            {items.length} de {MAX_COMPARE}
            {!href && ` · elegí al menos ${MIN_COMPARE}`}
          </span>
          <button type="button" className="compare-bar-clear" onClick={clearCompare}>
            Vaciar
          </button>
          {href ? (
            <Link className="button" href={href}>
              Comparar ({items.length})
            </Link>
          ) : (
            <span className="button compare-bar-disabled" aria-disabled="true">
              Comparar
            </span>
          )}
        </div>
      </aside>
    </>
  );
}
