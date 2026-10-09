"use client";

import { isFull, isSelected, MAX_COMPARE } from "@/lib/compare/selection";
import { toggleCompare, useCompareSelection } from "./compare-store";

// Casilla "Comparar": la selección se conserva entre búsquedas y páginas (ver compare-store.ts) y llega hasta 4 perfumes.
export function CompareCheckbox({ perfumeId, perfumeName, brand }: { perfumeId: string; perfumeName: string; brand: string }) {
  const items = useCompareSelection();
  const checked = isSelected(items, perfumeId);
  const blocked = isFull(items) && !checked;

  return (
    <label className="compare-toggle" title={blocked ? `Ya elegiste ${MAX_COMPARE} perfumes: quitá uno para sumar otro` : undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={blocked}
        onChange={() => toggleCompare({ id: perfumeId, brand, name: perfumeName })}
        aria-label={`Comparar ${perfumeName}`}
      />
      Comparar
    </label>
  );
}
