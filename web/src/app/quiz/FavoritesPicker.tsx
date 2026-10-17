"use client";

import { useEffect, useId, useRef, useState } from "react";

export type FavoritePerfume = { id: string; label: string };

type SearchResult = { id: string; brand: string; name: string };

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const RESULTS = 6;

// Buscador de "perfumes que ya amás" del quiz (opcional). Cada elegido viaja como un campo `favoritos` del formulario GET.
// Necesita JavaScript: sin él el paso se oculta (ver `@media (scripting: none)` en globals.css) y el quiz funciona igual.
export function FavoritesPicker({ initial, max }: { initial: FavoritePerfume[]; max: number }) {
  const inputId = useId();
  const statusId = useId();
  const [selected, setSelected] = useState<FavoritePerfume[]>(initial.slice(0, max));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const controller = useRef<AbortController | null>(null);

  const full = selected.length >= max;
  const trimmed = query.trim();
  // Con menos de MIN_QUERY letras o con el máximo elegido no se muestra nada de la búsqueda anterior.
  const searching = trimmed.length >= MIN_QUERY && !full;

  useEffect(() => {
    controller.current?.abort();
    if (!searching) return;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/perfumes?q=${encodeURIComponent(trimmed)}&pageSize=${RESULTS}`, { signal: abort.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { data?: SearchResult[] };
        setResults(Array.isArray(body.data) ? body.data.map(({ id, brand, name }) => ({ id, brand, name })) : []);
        setStatus("done");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setResults([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [trimmed, searching]);

  const add = (perfume: SearchResult) => {
    setSelected((current) =>
      current.length >= max || current.some((p) => p.id === perfume.id)
        ? current
        : [...current, { id: perfume.id, label: `${perfume.brand} — ${perfume.name}` }],
    );
    setQuery("");
  };

  const remove = (id: string) => setSelected((current) => current.filter((p) => p.id !== id));

  const available = !searching ? [] : results.filter((r) => !selected.some((p) => p.id === r.id));
  const message =
    full
      ? `Elegiste ${max} perfumes. Quitá uno para cambiarlo.`
      : !searching
        ? ""
        : status === "loading"
        ? "Buscando…"
        : status === "error"
          ? "No pudimos buscar ahora. Probá de nuevo en un rato."
          : status === "done"
            ? available.length === 0
              ? "No encontramos perfumes con ese nombre."
              : `${available.length} resultados`
            : "";

  return (
    <div className="quiz-favorites">
      {selected.map((perfume) => (
        <input key={perfume.id} type="hidden" name="favoritos" value={perfume.id} />
      ))}

      {selected.length > 0 && (
        <ul className="quiz-favorites-chosen" aria-label="Perfumes elegidos">
          {selected.map((perfume) => (
            <li key={perfume.id}>
              <span>{perfume.label}</span>
              <button type="button" onClick={() => remove(perfume.id)} aria-label={`Quitar ${perfume.label}`}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor={inputId}>Buscar un perfume por marca o nombre</label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Enter dentro del buscador no debe enviar el quiz entero.
          if (event.key === "Enter") event.preventDefault();
        }}
        disabled={full}
        autoComplete="off"
        maxLength={60}
        aria-describedby={statusId}
        placeholder="Ej.: Sauvage"
      />
      <p id={statusId} className="quiz-hint" role="status" aria-live="polite">
        {message}
      </p>

      {available.length > 0 && !full && (
        <ul className="quiz-favorites-results" aria-label="Resultados de la búsqueda">
          {available.map((perfume) => (
            <li key={perfume.id}>
              <button type="button" onClick={() => add(perfume)}>
                <span className="perfume-brand">{perfume.brand}</span> {perfume.name}
                <span className="sr-only"> — agregar a tus favoritos</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
