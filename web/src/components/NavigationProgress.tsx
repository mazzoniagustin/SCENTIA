"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_WAIT_MS = 12000;

// Barra fina arriba de la página que avanza mientras se carga otra página (enlace interno o búsqueda por formulario GET) y se
// completa al llegar. Mismo lenguaje visual que la barra del quiz. Es un indicador: no cambia cómo se navega.
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = `${pathname}?${search}`;

  const [state, setState] = useState({ active: false, value: 0 });
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const hider = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrl = useRef(url);

  const clearTimers = useCallback(() => {
    for (const ref of [ticker, hider, giveUp]) {
      if (ref.current) clearTimeout(ref.current as ReturnType<typeof setTimeout>);
      ref.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setState({ active: true, value: 100 });
    hider.current = setTimeout(() => setState({ active: false, value: 0 }), 350);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setState({ active: true, value: 8 });
    // Avanza cada vez más despacio hacia el 90 %: no llega a completarse hasta que la página cambia de verdad.
    ticker.current = setInterval(() => setState((s) => ({ active: true, value: s.value + (90 - s.value) * 0.1 })), 180);
    giveUp.current = setTimeout(finish, MAX_WAIT_MS);
  }, [clearTimers, finish]);

  // La URL cambió: la navegación terminó.
  useEffect(() => {
    if (currentUrl.current === url) return;
    currentUrl.current = url;
    finish();
  }, [url, finish]);

  useEffect(() => {
    const here = () => `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`;
    const isInternalTarget = (href: string) => {
      let target: URL;
      try {
        target = new URL(href, window.location.href);
      } catch {
        return false;
      }
      if (target.origin !== window.location.origin) return false;
      if (target.hash && target.pathname === window.location.pathname && target.search === window.location.search) return false; // salto interno
      return `${target.pathname}?${target.search.replace(/^\?/, "")}` !== here();
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      if (isInternalTarget(anchor.href)) start();
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || event.defaultPrevented || form.method.toLowerCase() !== "get") return;
      if (isInternalTarget(form.action)) start();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      clearTimers();
    };
  }, [start, clearTimers]);

  return (
    <>
      <div className="nav-progress" data-active={state.active} aria-hidden="true">
        <span style={{ transform: `scaleX(${state.value / 100})` }} />
      </div>
      <span className="sr-only" role="status">
        {state.active && state.value < 100 ? "Cargando página…" : ""}
      </span>
    </>
  );
}

export function NavigationProgress() {
  return <Bar />;
}
