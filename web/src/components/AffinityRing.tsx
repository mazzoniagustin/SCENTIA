"use client";

import { useScrollReveal } from "@/components/ScrollReveal";

// Anillo de afinidad: se dibuja cuando aparece en pantalla (no antes: así se ve aunque la tarjeta esté más abajo). Decorativo:
// el porcentaje también está en el texto de la tarjeta. Sin JavaScript queda dibujado completo.
export function AffinityRing({ percent, index = 0 }: { percent: number; index?: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const [ref, state] = useScrollReveal<HTMLDivElement>(0.6);
  return (
    <div
      ref={ref}
      className="affinity-ring"
      data-reveal={state}
      aria-hidden="true"
      style={{ "--p": value, "--delay": `${index * 60 + 200}ms` } as React.CSSProperties}
    >
      <svg viewBox="0 0 36 36">
        <circle className="affinity-track" cx="18" cy="18" r="15.9155" pathLength="100" />
        <circle className="affinity-fill" cx="18" cy="18" r="15.9155" pathLength="100" />
      </svg>
      <span>{value}%</span>
    </div>
  );
}
