'use client';

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

// Entrada de elementos al aparecer en pantalla. A diferencia de una animación por tiempo (que corre apenas se monta el
// elemento, aunque esté fuera de la ventana y nadie la vea) y de `animation-timeline: view()` (que depende del scroll del
// navegador), acá el movimiento se dispara por código cuando el elemento realmente entra en la ventana (IntersectionObserver).
//
// Estados de `data-reveal`:
//   static  → estado base: todo visible y sin movimiento (la persona pidió menos movimiento, o no hay observador).
//   pending → todavía no apareció en pantalla: el CSS lo deja listo para entrar (solo con prefers-reduced-motion: no-preference).
//   shown   → ya entró en pantalla: corre la animación.

export type RevealState = 'static' | 'pending' | 'shown';

/** ¿Se puede animar? Solo si la persona no pidió menos movimiento y el navegador tiene IntersectionObserver. */
export function canAnimate(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof IntersectionObserver === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Devuelve la referencia a poner en el elemento y su estado de entrada. Los resultados se montan siempre en el navegador
 * (después de tocar el botón), así que `canAnimate()` puede leerse al crear el estado sin diferencias con el servidor.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.3): [RefObject<T | null>, RevealState] {
  const ref = useRef<T>(null);
  const [state, setState] = useState<RevealState>(() => (canAnimate() ? 'pending' : 'static'));

  useEffect(() => {
    const el = ref.current;
    if (!el || state !== 'pending') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) {
          setState('shown');
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [state, threshold]);

  return [ref, state];
}

/** Elemento que entra al aparecer en pantalla; sus hijos pueden animarse según `[data-reveal]` en el CSS. */
export function Reveal({
  as = 'div',
  className,
  style,
  threshold,
  children,
  ...rest
}: {
  as?: 'div' | 'section' | 'ul' | 'p';
  className?: string;
  style?: CSSProperties;
  threshold?: number;
  children: ReactNode;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  const [ref, state] = useReveal<HTMLElement>(threshold);
  return createElement(as, { ref, className, style, 'data-reveal': state, ...rest }, children);
}

/**
 * Tiempo transcurrido (ms) desde que `active` pasó a verdadero, actualizado con requestAnimationFrame hasta `totalMs`.
 * Sin animación (`active` falso desde el principio con `skip`) devuelve infinito: todo queda en su valor final.
 */
export function useElapsed(active: boolean, skip: boolean, totalMs: number): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || skip) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = now - started;
      setElapsed(Math.min(t, totalMs));
      if (t < totalMs) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, skip, totalMs]);
  if (skip) return Number.POSITIVE_INFINITY;
  return active ? elapsed : 0;
}
