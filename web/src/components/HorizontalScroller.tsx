"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

// Carrusel horizontal: se desliza con el dedo, la rueda o el teclado (tiene foco), y suma botones anterior/siguiente.
// Sin JavaScript sigue funcionando como una lista con scroll horizontal.
//
// Con `autoAdvanceMs` es un "rollo": avanza solo, una tarjeta cada tanto y con un movimiento lento (SLOW_MS), y vuelve al
// principio al llegar al final. Se frena mientras el mouse está encima, mientras algo adentro tiene el foco, mientras la pestaña
// está oculta y siempre que la persona pidió menos movimiento (ahí no se mueve solo). Tiene un botón para pausarlo (WCAG 2.2.2).
// Con el mouse se puede arrastrar; con el dedo, deslizar; y los botones adelantan o retroceden una tarjeta.
// Además muestra unos puntos (uno por posición, también como botones de 44 px) y una barrita que se llena hasta el próximo avance;
// las tarjetas que quedan cortadas en los bordes se atenúan un poco (`data-edge`). Todo eso es solo del modo rollo.

const SLOW_MS = 1500; // lo que dura el paso automático de una tarjeta a la siguiente
const REWIND_MS = 2200; // lo que dura la vuelta al principio
const MANUAL_MS = 600; // pasos con los botones y ajuste al soltar el arrastre
const DRAG_THRESHOLD_PX = 5; // desde cuánto un gesto del mouse cuenta como arrastre y no como clic

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Distancia de una tarjeta a la siguiente (ancho + separación); si hay una sola, casi el ancho visible.
function stepOf(el: HTMLDivElement): number {
  const items = el.querySelectorAll<HTMLElement>(".scroller-item");
  return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : el.clientWidth * 0.85;
}

export function HorizontalScroller({
  label,
  children,
  autoAdvanceMs,
  className,
}: {
  label: string;
  children: ReactNode;
  autoAdvanceMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [nav, setNav] = useState({ stops: 1, active: 0 }); // posiciones del rollo y cuál está a la vista (solo modo rollo)
  const [tick, setTick] = useState(0); // cuenta los avances automáticos: reinicia la barrita de progreso
  const auto = autoAdvanceMs !== undefined;

  const [playing, setPlaying] = useState(true); // botón de pausa de la persona
  // Lo que frena el avance automático mientras dura: mouse encima, foco adentro, arrastre en curso o pestaña oculta.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const holding = hovered || focused || dragging || hidden;
  const [reduceMotion, setReduceMotion] = useState(true); // hasta saberlo, no se mueve solo
  const frame = useRef(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    if (!auto) return;
    const max = el.scrollWidth - el.clientWidth;
    const step = stepOf(el);
    const count = el.querySelectorAll(".scroller-item").length;
    const stops = max < 8 ? 1 : Math.min(Math.max(count, 1), Math.ceil((max - 4) / step) + 1);
    const active = el.scrollLeft >= max - 4 ? stops - 1 : Math.min(stops - 1, Math.round(el.scrollLeft / step));
    setNav((prev) => (prev.stops === stops && prev.active === active ? prev : { stops, active }));
    // Tarjetas cortadas por el borde: se atenúan un poco para marcar cuáles están a la vista.
    el.querySelectorAll<HTMLElement>(".scroller-item").forEach((item) => {
      const cut = item.offsetLeft < el.scrollLeft - 6 || item.offsetLeft + item.offsetWidth > el.scrollLeft + el.clientWidth + 6;
      if (cut) item.setAttribute("data-edge", "true");
      else item.removeAttribute("data-edge");
    });
  }, [auto]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  // Preferencia de movimiento y pestaña oculta (solo importan en modo rollo).
  useEffect(() => {
    if (!auto) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      query.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [auto]);

  const cancelAnimation = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  useEffect(() => cancelAnimation, [cancelAnimation]);

  // Mueve el scroll con una curva suave y lenta (no `behavior: smooth`, cuya duración no se controla).
  const animateTo = useCallback(
    (target: number, duration: number) => {
      const el = ref.current;
      if (!el) return;
      cancelAnimation();
      const from = el.scrollLeft;
      const distance = target - from;
      if (Math.abs(distance) < 1) return;
      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        el.scrollLeft = from + distance * easeInOut(t);
        frame.current = t < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame.current = requestAnimationFrame(tick);
    },
    [cancelAnimation],
  );

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    if (auto) {
      const max = el.scrollWidth - el.clientWidth;
      const step = stepOf(el);
      const current = Math.round(el.scrollLeft / step) * step;
      animateTo(Math.min(max, Math.max(0, current + direction * step)), reduceMotion ? 1 : MANUAL_MS);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const scrollable = !(edges.start && edges.end);
  const running = auto && playing && !holding && !reduceMotion && scrollable; // el avance automático está corriendo

  const goTo = (index: number) => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    animateTo(Math.min(max, Math.max(0, index * stepOf(el))), reduceMotion ? 1 : MANUAL_MS);
  };

  // Avance automático: una tarjeta cada `autoAdvanceMs`, y al final vuelve al principio.
  useEffect(() => {
    if (!auto || !autoAdvanceMs || !playing || holding || reduceMotion || !scrollable) return;
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      setTick((n) => n + 1);
      const max = el.scrollWidth - el.clientWidth;
      if (max < 8) return;
      if (el.scrollLeft >= max - 4) animateTo(0, REWIND_MS);
      else animateTo(Math.min(max, Math.round(el.scrollLeft / stepOf(el)) * stepOf(el) + stepOf(el)), SLOW_MS);
    }, autoAdvanceMs);
    return () => window.clearInterval(id);
  }, [auto, autoAdvanceMs, playing, holding, reduceMotion, scrollable, animateTo]);

  // Arrastre con el mouse (el dedo ya desliza solo). Un arrastre no cuenta como clic en los enlaces.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!auto || !el || event.pointerType !== "mouse" || event.button !== 0) return;
    cancelAnimation();
    drag.current = { x: event.clientX, left: el.scrollLeft, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const state = drag.current;
    if (!el || !state) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      state.moved = true;
      el.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (state.moved) el.scrollLeft = state.left - dx;
  };

  const endDrag = () => {
    const el = ref.current;
    const state = drag.current;
    drag.current = null;
    if (!el || !state?.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const step = stepOf(el);
    animateTo(Math.round(el.scrollLeft / step) * step, MANUAL_MS);
    setDragging(false);
  };

  return (
    <div className={["scroller", auto ? "scroller-reel" : "", className ?? ""].filter(Boolean).join(" ")}>
      <button type="button" className="scroller-button scroller-prev" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={`${label}: anteriores`}>
        <span aria-hidden="true">‹</span>
      </button>
      <div
        ref={ref}
        className={dragging ? "scroller-viewport is-dragging" : "scroller-viewport"}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={update}
        onMouseEnter={auto ? () => setHovered(true) : undefined}
        onMouseLeave={auto ? () => setHovered(false) : undefined}
        onFocus={auto ? () => setFocused(true) : undefined}
        onBlur={auto ? (event) => setFocused(event.currentTarget.contains(event.relatedTarget)) : undefined}
        onWheel={auto ? cancelAnimation : undefined}
        onTouchStart={auto ? cancelAnimation : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={auto ? (event) => event.preventDefault() : undefined}
        onClickCapture={
          auto
            ? (event) => {
                if (suppressClick.current) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }
            : undefined
        }
      >
        {children}
      </div>
      <button type="button" className="scroller-button scroller-next" onClick={() => scrollBy(1)} disabled={edges.end} aria-label={`${label}: siguientes`}>
        <span aria-hidden="true">›</span>
      </button>
      {auto && scrollable && (
        <div className="scroller-footer">
          {/* Cuánto falta para el próximo avance: se vacía al frenarse el rollo y se reinicia con cada avance. */}
          <span className="scroller-progress" aria-hidden="true">
            {running && <span key={tick} className="scroller-progress-fill" style={{ animationDuration: `${autoAdvanceMs}ms` }} />}
          </span>
          {nav.stops > 1 && (
            <div className="scroller-dots" role="group" aria-label={`${label}: posición`}>
              {Array.from({ length: nav.stops }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="scroller-dot"
                  aria-label={`Ir a la posición ${i + 1} de ${nav.stops}`}
                  aria-current={i === nav.active ? "true" : undefined}
                  onClick={() => goTo(i)}
                >
                  <span className="scroller-dot-mark" />
                </button>
              ))}
            </div>
          )}
          {!reduceMotion && (
            <button type="button" className="scroller-pause" onClick={() => setPlaying((value) => !value)}>
              {playing ? "Pausar el avance automático" : "Reanudar el avance automático"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
