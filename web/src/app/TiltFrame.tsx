"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

const MAX_TILT_DEG = 8;

// Inclina su contenido hacia el puntero (mouse o dedo) con perspective + rotateX/Y de CSS. Solo escribe variables CSS en el
// elemento (sin estado de React, sin re-renders) y con `prefers-reduced-motion: reduce` no se mueve nada: el CSS ignora las variables.
export function TiltFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const frameId = useRef(0);

  function reset() {
    cancelAnimationFrame(frameId.current);
    const frame = frameRef.current;
    if (!frame) return;
    frame.removeAttribute("data-tilting");
    frame.style.removeProperty("--tilt-x");
    frame.style.removeProperty("--tilt-y");
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frameId.current);
    frameId.current = requestAnimationFrame(() => {
      const rect = frame.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      frame.setAttribute("data-tilting", "true");
      frame.style.setProperty("--tilt-x", `${(-y * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
      frame.style.setProperty("--tilt-y", `${(x * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
    });
  }

  return (
    <div
      ref={frameRef}
      className="tilt-frame"
      onPointerMove={handleMove}
      onPointerLeave={reset}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <div className="tilt-inner">{children}</div>
    </div>
  );
}
