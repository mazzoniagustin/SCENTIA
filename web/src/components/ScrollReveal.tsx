"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { decideScrollReveal, type ScrollRevealState } from "@/lib/motion/scroll-reveal";

// Entrada al aparecer en pantalla para contenido que llega renderizado del servidor. Una animación por tiempo corre apenas
// carga la página, aunque el elemento esté más abajo, y termina antes de que alguien lo vea; acá el movimiento arranca cuando
// el elemento realmente entra en la ventana (IntersectionObserver). Mismo patrón que `data-reveal` de /mi-coleccion, pero
// con un estado inicial `initial` que es el del servidor: sin JavaScript todo se ve completo (ver lib/motion/scroll-reveal.ts).

function canAnimate(): boolean {
  if (typeof IntersectionObserver === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useScrollReveal<T extends HTMLElement | SVGElement>(threshold = 0.25): [RefObject<T | null>, ScrollRevealState] {
  const ref = useRef<T>(null);
  const [state, setState] = useState<ScrollRevealState>("initial");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = decideScrollReveal({ canAnimate: canAnimate(), rect: el.getBoundingClientRect(), viewportHeight: window.innerHeight });
    if (next !== "pending") {
      if (next === "static") setState("static");
      return;
    }
    setState("pending");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, state];
}

/** Contenedor que marca `data-reveal` según su entrada en pantalla; el CSS anima a sus hijos (barras de la ficha). */
export function ScrollReveal({
  as = "div",
  className,
  style,
  children,
}: {
  as?: "div" | "ul";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [ref, state] = useScrollReveal<HTMLElement>();
  return createElement(as, { ref, className, style, "data-reveal": state }, children);
}
