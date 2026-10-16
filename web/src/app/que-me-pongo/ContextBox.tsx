'use client';

import { useId, useState, type FormEvent } from 'react';

import { CONTEXT_EXAMPLES } from '@/lib/outfit/context';

export type ContextState =
  | { enabled: boolean; status: 'none' }
  | { enabled: boolean; status: 'applied'; summary: string }
  | { enabled: boolean; status: 'not_understood' | 'unavailable' | 'rate_limited' | 'invalid_text'; message: string };

// Cuadro de contexto (ADR-011): "voy a ver un partido en un lugar cerrado". La IA solo traduce el texto a filtros; el motor decide.
// Solo se muestra si el servidor lo tiene habilitado.
export function ContextBox({
  state,
  busy,
  onSubmit,
  onClear,
}: {
  state: ContextState;
  busy: boolean;
  onSubmit: (text: string) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState('');
  const fieldId = useId();
  const hintId = useId();
  const tooShort = text.trim().length < 3;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && !tooShort) onSubmit(text.trim());
  }

  return (
    <form className="outfit-context" onSubmit={submit} aria-labelledby={`${fieldId}-title`}>
      <h3 id={`${fieldId}-title`} className="outfit-subtitle">
        ¿Qué vas a hacer hoy?
      </h3>
      <label htmlFor={fieldId} className="form-hint">
        Contale tu plan a la IA y afinamos la recomendación (opcional).
      </label>
      <textarea
        id={fieldId}
        className="gaps-refine-input"
        rows={2}
        maxLength={200}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ej.: voy a ver un partido de vóley en un lugar cerrado"
        aria-describedby={hintId}
      />
      <p id={hintId} className="form-hint">
        {text.length} / 200. Lo que escribas se envía a Gemini (Google), que en el nivel gratuito puede usar el contenido para mejorar
        sus productos: no escribas datos personales. La IA solo interpreta tu plan; el perfume lo elige tu colección y el clima.
      </p>
      <div className="gaps-refine-examples" aria-label="Ejemplos">
        {CONTEXT_EXAMPLES.map((example) => (
          <button key={example} type="button" className="gaps-gender-chip" onClick={() => setText(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>
      <div className="outfit-actions">
        <button type="submit" className="button" disabled={busy || tooShort} aria-busy={busy}>
          {busy ? 'Interpretando…' : 'Afinar'}
        </button>
        {state.status === 'applied' && (
          <button type="button" className="button button-ghost" onClick={onClear} disabled={busy}>
            Quitar el plan
          </button>
        )}
      </div>
      <div role="status" aria-live="polite" className="outfit-context-status">
        {state.status === 'applied' && (
          <p>
            <span className="outfit-chip">Interpretado con IA</span> {state.summary}
          </p>
        )}
        {(state.status === 'not_understood' || state.status === 'unavailable' || state.status === 'rate_limited' || state.status === 'invalid_text') && (
          <p className="notice">{state.message}</p>
        )}
      </div>
    </form>
  );
}
