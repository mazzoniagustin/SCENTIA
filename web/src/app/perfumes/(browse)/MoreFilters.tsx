"use client";

import { useEffect, useRef, type ReactNode } from "react";

// "Más filtros": en escritorio arranca abierto si hay filtros de este grupo; en el celular queda plegado
// aunque los haya, porque los chips de arriba ya los muestran. Sin JavaScript no hay forma de saber el ancho,
// así que el HTML llega con `open` según los filtros y este efecto lo pliega al montar solo en ancho móvil.
// (Debe coincidir con el corte móvil de globals.css: 640 px.)
export function MoreFilters({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (defaultOpen && window.matchMedia("(max-width: 639px)").matches) ref.current?.removeAttribute("open");
  }, [defaultOpen]);

  return (
    <details ref={ref} className="catalog-more" open={defaultOpen}>
      {children}
    </details>
  );
}
