"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Carrusel horizontal: se desliza con el dedo, la rueda o el teclado (tiene foco), y suma botones anterior/siguiente.
// Sin JavaScript sigue funcionando como una lista con scroll horizontal.
export function HorizontalScroller({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="scroller">
      <button type="button" className="scroller-button scroller-prev" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={`${label}: anteriores`}>
        <span aria-hidden="true">‹</span>
      </button>
      <div ref={ref} className="scroller-viewport" role="region" aria-label={label} tabIndex={0} onScroll={update}>
        {children}
      </div>
      <button type="button" className="scroller-button scroller-next" onClick={() => scrollBy(1)} disabled={edges.end} aria-label={`${label}: siguientes`}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
