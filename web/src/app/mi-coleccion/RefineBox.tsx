'use client';

import { useEffect, useId, useState } from 'react';

import type { GenderFilter } from '@/lib/gaps/gender';
import { REFINE_EXAMPLES, refineAnnouncement, refineViewFromResponse, type RefinedList, type RefineView } from '@/lib/gaps/view';

// Cuadro para afinar las sugerencias con un texto libre (ADR-010). La IA solo traduce el texto a filtros; los perfumes los elige
// el ranking del catálogo. Se muestra solo si el servidor lo tiene habilitado.
export function RefineBox({
  maxChars,
  gender,
  onRefined,
}: {
  maxChars: number;
  gender: GenderFilter;
  onRefined: (refined: RefinedList) => void;
}) {
  const [text, setText] = useState('');
  const [view, setView] = useState<RefineView>({ kind: 'idle' });
  const fieldId = useId();
  const hintId = useId();

  const loading = view.kind === 'loading';
  const waiting = view.kind === 'rate_limited' && view.seconds > 0;
  const tooShort = text.trim().length < 3;

  // Cuenta regresiva del Retry-After: el botón queda deshabilitado hasta que llega a 0.
  useEffect(() => {
    if (view.kind !== 'rate_limited' || view.seconds <= 0) return;
    const timer = window.setTimeout(() => setView({ kind: 'rate_limited', seconds: view.seconds - 1 }), 1000);
    return () => window.clearTimeout(timer);
  }, [view]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || waiting || tooShort) return;
    setView({ kind: 'loading' });
    try {
      const res = await fetch('/api/collection/gaps/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), gender }),
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const next = refineViewFromResponse(res.status, res.headers.get('Retry-After'), body);
      setView(next);
      if (next.kind === 'ok') onRefined(next.refined);
    } catch {
      setView({ kind: 'network' });
    }
  }

  return (
    <form className="gaps-refine" onSubmit={submit} aria-labelledby={`${fieldId}-title`}>
      <h4 id={`${fieldId}-title`} className="gaps-group-title">
        Afiná las sugerencias
      </h4>
      <label htmlFor={fieldId} className="form-hint">
        Contale a la IA para qué lo necesitás o qué estilo te gusta.
      </label>
      <textarea
        id={fieldId}
        className="gaps-refine-input"
        rows={2}
        maxLength={maxChars}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ej.: lo necesito para una ocasión especial · me gusta el estilo de Sauvage"
        aria-describedby={hintId}
      />
      <p id={hintId} className="form-hint">
        {text.length} / {maxChars}. No escribas datos personales. La IA solo interpreta tu pedido; los perfumes salen del catálogo.
      </p>

      <div className="gaps-refine-examples" aria-label="Ejemplos">
        {REFINE_EXAMPLES.map((example) => (
          <button key={example} type="button" className="gaps-gender-chip" onClick={() => setText(example)} disabled={loading}>
            {example}
          </button>
        ))}
      </div>

      <div className="outfit-actions">
        <button type="submit" className="button" disabled={loading || waiting || tooShort} aria-busy={loading}>
          {loading ? 'Interpretando…' : 'Afinar'}
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {refineAnnouncement(view)}
      </div>

      {view.kind === 'not_understood' && <p className="notice">{view.message}</p>}
      {view.kind === 'unavailable' && <p className="notice">No pudimos interpretar tu pedido ahora. Probá de nuevo en un rato.</p>}
      {view.kind === 'error' && <p className="notice">Algo salió mal. Probá de nuevo.</p>}
      {view.kind === 'network' && <p className="notice">No hay conexión. Revisala y probá de nuevo.</p>}
      {view.kind === 'rate_limited' && (
        <p className="notice">Hiciste muchas consultas seguidas{view.seconds > 0 ? `: probá de nuevo en ${view.seconds} s` : ''}.</p>
      )}
      {view.kind === 'unauthorized' && <p className="notice">Tu sesión venció. Ingresá de nuevo para afinar.</p>}
    </form>
  );
}
